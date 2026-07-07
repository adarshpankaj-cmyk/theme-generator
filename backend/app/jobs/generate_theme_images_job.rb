# frozen_string_literal: true

# Generates the two artwork images for a theme, then computes its tint and marks
# it ready (F2). Enqueued by the generate/regenerate endpoints. The generation
# itself is implemented by ImageGenerationService.
class GenerateThemeImagesJob < ApplicationJob
  queue_as :default

  # @param theme_id [Integer]
  def perform(theme_id)
    theme = Theme.find(theme_id)
    ImageGenerationService.new(theme).call
  end
end
