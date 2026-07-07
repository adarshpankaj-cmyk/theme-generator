# frozen_string_literal: true

# PromptBuilder — wraps a user's theme prompt in the readability guardrail
# (F2, SPEC.md §6.1), producing the final per-canvas prompt sent to the image
# model. The guardrail template is editable config (config/guardrail_prompt.yml).
class PromptBuilder
  CONFIG_PATH = Rails.root.join("config", "guardrail_prompt.yml").freeze

  def initialize(user_prompt)
    @user_prompt = user_prompt.to_s
  end

  # @param canvas [String] "a4" or "a5"
  # @return [String] the guardrail-wrapped prompt for that canvas.
  def for_canvas(canvas)
    config.fetch("guardrail")
          .gsub("{{USER_PROMPT}}", @user_prompt)
          .gsub("{{ORIENTATION}}", orientation(canvas))
  end

  private

  def orientation(canvas)
    config.fetch("orientation").fetch(canvas.to_s) do
      raise ArgumentError, "No orientation configured for canvas #{canvas.inspect}"
    end
  end

  def config
    @config ||= YAML.safe_load_file(CONFIG_PATH)
  end
end
