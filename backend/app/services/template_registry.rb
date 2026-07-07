# frozen_string_literal: true

# TemplateRegistry — the deterministic core (F1).
#
# Loads the 9 CSS template definitions from config/theme_templates.yml and
# exposes them as immutable value objects. The registry is the single source of
# truth for canvas, selector list, and default opacity per template; the CSS
# assembler (F3) reads from here. See backend/SPEC.md §3.
#
# Usage:
#   TemplateRegistry.all            # => [Template, ...] in registry order
#   TemplateRegistry.find("theme_one")
#   TemplateRegistry.ids            # => ["theme_luxury", ...]
module TemplateRegistry
  CONFIG_PATH = Rails.root.join("config", "theme_templates.yml").freeze

  # Valid canvas values. A4 = portrait, A5 = landscape (see SPEC.md).
  CANVASES = %w[a4 a5].freeze

  # Immutable value object for a single template definition.
  Template = Data.define(:id, :canvas, :layout, :default_opacity, :selectors) do
    def a4?
      canvas == "a4"
    end

    def a5?
      canvas == "a5"
    end
  end

  class Error < StandardError; end

  # Raised when a template id is requested that does not exist in the registry.
  class UnknownTemplateError < Error; end

  class << self
    # All templates in registry (file) order.
    # @return [Array<Template>]
    def all
      registry.values
    end

    # Ordered list of template ids.
    # @return [Array<String>]
    def ids
      registry.keys
    end

    # @return [Boolean] whether a template with this id exists.
    def exists?(id)
      registry.key?(id.to_s)
    end

    # Fetch a single template by id.
    # @param id [String, Symbol]
    # @return [Template]
    # @raise [UnknownTemplateError] if the id is not registered.
    def find(id)
      registry.fetch(id.to_s) do
        raise UnknownTemplateError, "Unknown template: #{id.inspect}. Known: #{ids.join(', ')}"
      end
    end

    # Force a reload of the YAML (used in tests / after editing config).
    # @return [void]
    def reload!
      @registry = nil
    end

    private

    # Memoized id => Template map, preserving YAML order.
    def registry
      @registry ||= load_registry
    end

    def load_registry
      raw = YAML.safe_load_file(CONFIG_PATH)
      raise Error, "#{CONFIG_PATH} is empty or invalid" if raw.nil? || raw.empty?

      raw.each_with_object({}) do |(id, attrs), acc|
        acc[id] = build_template(id, attrs)
      end.freeze
    end

    def build_template(id, attrs)
      canvas = attrs.fetch("canvas")
      unless CANVASES.include?(canvas)
        raise Error, "Template #{id}: invalid canvas #{canvas.inspect} (expected one of #{CANVASES.join('/')})"
      end

      selectors = Array(attrs.fetch("selectors")).map(&:freeze).freeze
      raise Error, "Template #{id}: selectors must not be empty" if selectors.empty?

      Template.new(
        id: id.freeze,
        canvas: canvas.freeze,
        layout: attrs["layout"]&.freeze,
        default_opacity: Float(attrs.fetch("default_opacity")),
        selectors: selectors
      )
    end
  end
end
