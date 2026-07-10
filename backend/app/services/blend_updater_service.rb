# frozen_string_literal: true

# BlendUpdaterService — applies a per-template blend edit (opacity / tint /
# per-strip settings) to a theme's `blend_overrides`, persists it, and returns
# the recomputed CSS. Powers `PATCH /themes/:id/blend` (SPEC.md §8, §4.1).
class BlendUpdaterService
  TEMPLATE_KEYS = %w[artwork_opacity tint_hex blend_mode].freeze

  # @param theme [Theme]
  # @param template_id [String]
  # @param attrs [Hash] any of "artwork_opacity", "tint_hex", "strips"
  def initialize(theme, template_id, attrs)
    @theme = theme
    @template_id = template_id.to_s
    @attrs = attrs.to_h.stringify_keys
    raise TemplateRegistry::UnknownTemplateError, "Unknown template: #{@template_id.inspect}" \
      unless TemplateRegistry.exists?(@template_id)
  end

  # @return [String] the recomputed, normalized CSS for the template.
  def call
    overrides = (@theme.blend_overrides || {}).deep_dup
    template = overrides[@template_id] ||= {}

    TEMPLATE_KEYS.each do |key|
      template[key] = @attrs[key] if @attrs.key?(key)
    end

    if @attrs.key?("strips")
      template["strips"] = (template["strips"] || {}).deep_merge(coerce_strips(@attrs["strips"]))
    end

    @theme.update!(blend_overrides: overrides)
    CssAssemblerService.new(@theme, @template_id).call
  end

  private

  # HTTP params arrive as strings; store clean JSON types so overrides read back
  # as real booleans/numbers (e.g. enabled: false, alpha: 0.8).
  def coerce_strips(strips)
    strips.to_h.transform_values do |settings|
      settings = settings.to_h.stringify_keys
      settings["enabled"] = ActiveModel::Type::Boolean.new.cast(settings["enabled"]) if settings.key?("enabled")
      settings["alpha"] = settings["alpha"].to_f if settings.key?("alpha")
      settings
    end
  end
end
