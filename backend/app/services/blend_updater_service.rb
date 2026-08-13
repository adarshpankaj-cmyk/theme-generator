# frozen_string_literal: true

# BlendUpdaterService — applies a blend edit (opacity / tint / per-strip
# settings) to a theme's `blend_overrides`, persists it, and returns the
# recomputed CSS for every template the edit touched. Powers
# `PATCH /themes/:id/blend` (SPEC.md §8, §4.1).
#
# Scope differs by attribute. Tint and strips are per-template: they describe
# one layout's furniture. Artwork opacity is per-*canvas* — it is how strongly
# the artwork reads behind a page of a given size, so setting it on any A4
# template applies to every A4 template, and likewise for A5. That is why a
# single edit can come back with several templates' CSS.
class BlendUpdaterService
  # Keys stored against the edited template alone.
  TEMPLATE_KEYS = %w[tint_hex].freeze

  # Keys fanned out to every template sharing the edited template's canvas.
  CANVAS_KEYS = %w[artwork_opacity].freeze

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

  # @return [Array<Hash>] `[{ template_id:, css: }, …]` in registry order, for
  #   every template whose CSS this edit changed.
  def call
    overrides = (@theme.blend_overrides || {}).deep_dup

    apply_template_attrs(overrides)
    touched = [@template_id] + apply_canvas_attrs(overrides)

    @theme.update!(blend_overrides: overrides)
    recompute(touched)
  end

  private

  # Tint and strips land on the edited template only.
  def apply_template_attrs(overrides)
    entry = (overrides[@template_id] ||= {})

    TEMPLATE_KEYS.each do |key|
      entry[key] = @attrs[key] if @attrs.key?(key)
    end

    return unless @attrs.key?("strips")

    entry["strips"] = (entry["strips"] || {}).deep_merge(coerce_strips(@attrs["strips"]))
  end

  # Opacity lands on every template of the edited template's canvas.
  # @return [Array<String>] the template ids written to.
  def apply_canvas_attrs(overrides)
    present = CANVAS_KEYS.select { |key| @attrs.key?(key) }
    return [] if present.empty?

    canvas_template_ids.each do |id|
      entry = (overrides[id] ||= {})
      present.each { |key| entry[key] = @attrs[key].to_f }
    end
  end

  # Every template rendered on the same canvas as the edited one.
  # @return [Array<String>]
  def canvas_template_ids
    canvas = TemplateRegistry.find(@template_id).canvas
    TemplateRegistry.all.select { |template| template.canvas == canvas }.map(&:id)
  end

  # @param template_ids [Array<String>]
  # @return [Array<Hash>] deduped, in registry order.
  def recompute(template_ids)
    order = TemplateRegistry.ids
    template_ids.uniq.sort_by { |id| order.index(id) }.map do |id|
      { template_id: id, css: CssAssemblerService.new(@theme, id).call }
    end
  end

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
