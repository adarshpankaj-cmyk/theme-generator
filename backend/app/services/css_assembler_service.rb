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

  def initialize(theme, template_id)
    @theme = theme
    @template = TemplateRegistry.find(template_id)
    @overrides = theme.overrides_for(template_id)
  end

  # @return [String] the normalized latest.css for this theme + template.
  def call
    css = format(
      TEMPLATE,
      overlay_name: @theme.slug,
      canvas: @template.canvas,
      opacity: format_number(effective_opacity),
      rules: build_rules
    )
    self.class.normalize(css)
  end

  # Normalize a CSS string so semantically-equal files compare equal despite the
  # reference source's inconsistencies (SPEC.md §2.2 / §11): LF endings, no
  # trailing whitespace, always `mix-blend-mode: multiply !important;`, always
  # the `transform` line, and no surrounding blank lines.
  # @param css [String]
  # @return [String]
  def self.normalize(css)
    lines = css.gsub("\r\n", "\n").tr("\r", "\n").split("\n", -1).map do |line|
      line.rstrip.sub(/(mix-blend-mode:\s*multiply)\s*(?:!important)?\s*;/, '\1 !important;')
    end
    text = lines.join("\n")

    unless text.include?("transform: translate(0%, 0%) scale(1);")
      text = text.sub("  position: relative;\n", "  position: relative;\n#{TRANSFORM_LINE}\n")
    end

    text.strip
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

  # The single shared rule that tints all default strips (SPEC.md §2.1).
  def shared_rule(selectors)
    <<~RULE.strip
      #{selectors.join(",\n")} {
        background-color: #{template_tint} !important;
        mix-blend-mode: multiply !important;
      }
    RULE
  end

  # A dedicated rule for one customized strip, using rgba(tint, alpha) (§7).
  def custom_rule(selector, override)
    hex = (override["tint_hex"] || template_tint).to_s.upcase
    alpha = override.key?("alpha") ? format_number(override["alpha"]) : "1"
    <<~RULE.strip
      #{selector} {
        background-color: #{rgba(hex, alpha)} !important;
        mix-blend-mode: multiply !important;
      }
    RULE
  end

  # Convert "#RRGGBB" + alpha into an "rgba(r, g, b, a)" string.
  def rgba(hex, alpha)
    r, g, b = hex.delete("#").scan(/../).map { |c| c.to_i(16) }
    "rgba(#{r}, #{g}, #{b}, #{alpha})"
  end

  # Format a numeric like CSS expects: no trailing zeros, no exponent (0.35, 0.3).
  def format_number(value)
    format("%g", value.to_f)
  end
end
