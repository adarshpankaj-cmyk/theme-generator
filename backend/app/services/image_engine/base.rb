# frozen_string_literal: true

module ImageEngine
  # Interface every engine implements.
  class Base
    # Generate a single image from a text prompt.
    # @param prompt [String]
    # @return [String] raw (binary) image bytes.
    def generate(prompt:)
      raise NotImplementedError, "#{self.class} must implement #generate"
    end
  end
end
