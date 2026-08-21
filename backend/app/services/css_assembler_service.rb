# frozen_string_literal: true

# CssAssemblerService — renders one template's normalized `latest.css` for a
# theme (F3). Deterministic: no AI. Resolves canvas/opacity/tint/selectors from
# the registry + the theme's blend overrides (SPEC.md §4.1), groups default
# strips into the single shared rule, emits custom strips as their own
# rgba(...) rules (§7), and normalizes the output (§2.2).
#
#   CssAssemblerService.new(theme, "theme_one").call # => normalized CSS string
class CssAssemblerService
  # The canonical latest.css skeleton (SPEC.md §2.1). `%{rules}` is replaced by
  # the tint rule(s); everything else is substituted per theme/template.
  TEMPLATE = <<~CSS
    body {
      position: relative;
      transform: translate(0%%, 0%%) scale(1);
    }

    body::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      width: 100%%;
      height: 100%%;
      min-height: 100vh;
      background-image: url("./flash-themes/%{overlay_name}/images/%{canvas}.jpeg");
      background-size: cover;
      background-position: center;
      opacity: %{opacity};
      z-index: -1;
      pointer-events: none;
    }
    %{rules}
  CSS

  TRANSFORM_LINE = "  transform: translate(0%, 0%) scale(1);"

  # `height: 100%` on the absolutely-positioned overlay resolves against the
  # *body* box, which is only as tall as the invoice content — on a short
  # invoice that leaves the rest of the page uncovered (measured: 43px of a
  # 1123px A4 page). The reference themes have the same gap. `min-height`
  # makes the overlay cover whichever is taller, the content or the page; it
  # is inert otherwise, since the overlay is z-index:-1 / pointer-events:none.
  MIN_HEIGHT_LINE = "  min-height: 100vh;"

  # @param theme [Theme]
  # @param template_id [String]
  # @param overlay_name [String, nil] the packaged folder name the artwork url
  #   should point at. Defaults to the theme's slug; the packager passes a
  #   download-time name so the css matches the folder it ships in.
  def initialize(theme, template_id, overlay_name: nil)
    @theme = theme
    @template = TemplateRegistry.find(template_id)
    @overrides = theme.overrides_for(template_id)
    @overlay_name = overlay_name.presence || theme.slug
  end

  # @return [String] the normalized latest.css for this theme + template.
  def call
    css = format(
      TEMPLATE,
      overlay_name: @overlay_name,
      canvas: @template.canvas,
      opacity: format_number(effective_opacity),
      rules: build_rules
    )
    self.class.normalize(css)
  end

  # Normalize a CSS string so semantically-equal files compare equal despite the
  # reference source's inconsistencies (SPEC.md §2.2 / §11): LF endings, no
  # trailing whitespace, always a `!important` on whatever `mix-blend-mode` is
  # emitted (default `multiply`, or any user-picked mode), always the
  # `transform` line, always the `min-height` overlay guard, solid strip tints
  # lifted to `rgba(tint, opacity)`, and no surrounding blank lines.
  #
  # Normalizing the reference up to our output (rather than the reverse) is what
  # keeps the F3 golden test honest about deliberate divergences: the reference
  # files stay exactly as captured from ThemeStore, so every byte we do *not*
  # deliberately diverge on is still compared. See MIN_HEIGHT_LINE and
  # `lift_strip_tints`.
  # @param css [String]
  # @return [String]
  def self.normalize(css)
    lines = css.gsub("\r\n", "\n").tr("\r", "\n").split("\n", -1).map do |line|
      line.rstrip.sub(/(mix-blend-mode:\s*[a-z-]+)\s*(?:!important)?\s*;/, '\1 !important;')
    end
    text = lines.join("\n")

    unless text.include?("transform: translate(0%, 0%) scale(1);")
      text = text.sub("  position: relative;\n", "  position: relative;\n#{TRANSFORM_LINE}\n")
    end

    unless text.include?("min-height: 100vh;")
      text = text.sub("  height: 100%;\n", "  height: 100%;\n#{MIN_HEIGHT_LINE}\n")
    end

    lift_strip_tints(text).strip
  end

  # Our shared strip rule paints `rgba(tint, opacity)` so the whole overlay —
  # watermark and tints — fades with the one artwork-opacity control, whereas the
  # reference themes paint a solid `#RRGGBB` and let only the watermark fade.
  # Rewrite a solid strip tint into the rgba form our assembler emits, using the
  # overlay opacity declared in the same file, so the reference normalizes up to
  # this divergence instead of the fixtures being rewritten to match it.
  #
  # A no-op on our own output (already rgba) and on any CSS without an overlay
  # opacity. Only strip rules carry `background-color`; the overlay itself uses
  # `background-image`, so nothing else is touched.
  # @param text [String]
  # @return [String]
  def self.lift_strip_tints(text)
    opacity = text[/^\s*opacity:\s*([0-9.]+);/, 1]
    return text unless opacity

    text.gsub(/background-color:\s*(#[0-9A-Fa-f]{6})\s*!important;/) do
      "background-color: #{rgba(Regexp.last_match(1), opacity)} !important;"
    end
  end

  # Convert "#RRGGBB" + alpha into an "rgba(r, g, b, a)" string.
  # @return [String]
  def self.rgba(hex, alpha)
    r, g, b = hex.delete("#").scan(/../).map { |component| component.to_i(16) }
    "rgba(#{r}, #{g}, #{b}, #{alpha})"
  end

  private

  # Template-level opacity: template override → theme default → registry default.
  def effective_opacity
    @overrides["artwork_opacity"] || @theme.artwork_opacity || @template.default_opacity
  end

  # Template-level tint: template override → theme default.
  def template_tint
    (@overrides["tint_hex"] || @theme.tint_hex).to_s.upcase
  end

  # Template-level blend mode: override → default `multiply`. Applied to every
  # strip rule (SPEC.md §7). Kept as a plain CSS keyword; `normalize` forces the
  # trailing `!important`.
  def effective_blend_mode
    @overrides["blend_mode"].presence&.to_s || "multiply"
  end

  # Per-template strip overrides ({ selector => { enabled?, tint_hex?, alpha? } }).
  def strip_overrides
    @overrides["strips"] || {}
  end

  # Build the tint rules: one shared rule for default strips, plus a dedicated
  # rgba(...) rule per customized strip. Disabled strips are omitted entirely.
  def build_rules
    default_selectors = []
    custom_rules = []

    @template.selectors.each do |selector|
      override = strip_overrides[selector] || {}
      next unless strip_enabled?(override)

      if custom_strip?(override)
        custom_rules << custom_rule(selector, override)
      else
        default_selectors << selector
      end
    end

    rules = []
    rules << shared_rule(default_selectors) if default_selectors.any?
    rules.concat(custom_rules)
    rules.join("\n")
  end

  # Robust to real booleans and string values ("false"/"0") from JSON/params.
  def strip_enabled?(override)
    return true unless override.key?("enabled")

    ActiveModel::Type::Boolean.new.cast(override["enabled"])
  end

  # A strip is "custom" when it carries its own tint or alpha (SPEC.md §7).
  def custom_strip?(override)
    override.key?("tint_hex") || override.key?("alpha")
  end

  # The single shared rule that tints all default strips. The tint carries the
  # template's effective opacity so the whole overlay (watermark + strips) fades
  # together with the artwork-opacity control. (Intentionally diverges from the
  # legacy solid-tint ThemeStore reference — see SPEC.md §2.1.)
  def shared_rule(selectors)
    <<~RULE.strip
      #{selectors.join(",\n")} {
        background-color: #{rgba(template_tint, format_number(effective_opacity))} !important;
        mix-blend-mode: #{effective_blend_mode} !important;
      }
    RULE
  end

  # A dedicated rule for one customized strip (§7). Per-strip `alpha` is a
  # *relative* multiplier on the template opacity, so the rendered tint alpha is
  # `effective_opacity × alpha` (defaulting to the effective opacity when the
  # strip only overrides its tint).
  def custom_rule(selector, override)
    hex = (override["tint_hex"] || template_tint).to_s.upcase
    multiplier = override.key?("alpha") ? override["alpha"].to_f : 1.0
    alpha = format_number(effective_opacity * multiplier)
    <<~RULE.strip
      #{selector} {
        background-color: #{rgba(hex, alpha)} !important;
        mix-blend-mode: #{effective_blend_mode} !important;
      }
    RULE
  end

  # Convert "#RRGGBB" + alpha into an "rgba(r, g, b, a)" string.
  def rgba(hex, alpha)
    self.class.rgba(hex, alpha)
  end

  # Format a numeric like CSS expects: no trailing zeros, no exponent (0.35, 0.3).
  def format_number(value)
    format("%g", value.to_f)
  end
end
