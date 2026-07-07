# frozen_string_literal: true

require "vips"
require "stringio"

# ImageGenerationService — generates the two artwork images for a theme (F2).
# For each canvas it builds a guardrail-wrapped prompt, calls the image engine,
# smart-crops the result to exact px with libvips, and attaches it. When both
# succeed it computes the tint (§5) and marks the theme ready; on any failure it
# marks the theme failed with the error message. See SPEC.md §6.
class ImageGenerationService
  # canvas => { attachment, and the ENV keys / defaults for exact dimensions }.
  CANVASES = {
    "a4" => { attachment: :a4_image, width_env: "A4_WIDTH", height_env: "A4_HEIGHT",
              default_width: 600, default_height: 848 },
    "a5" => { attachment: :a5_image, width_env: "A5_WIDTH", height_env: "A5_HEIGHT",
              default_width: 1024, default_height: 724 }
  }.freeze

  def initialize(theme, engine: ImageEngine::OpenRouter.new)
    @theme = theme
    @engine = engine
    @prompt_builder = PromptBuilder.new(theme.prompt)
  end

  # Run the full generation. Returns true on success, false on handled failure.
  # @return [Boolean]
  def call
    a4_bytes = nil

    CANVASES.each do |canvas, config|
      raw = @engine.generate(prompt: @prompt_builder.for_canvas(canvas))
      processed = resize(raw, dimension(config, :width), dimension(config, :height))
      a4_bytes = processed if canvas == "a4"
      attach(config[:attachment], processed, canvas)
    end

    @theme.update!(
      tint_hex: TintSamplerService.new(a4_bytes).call,
      status: :ready,
      error_message: nil
    )
    true
  rescue StandardError => e
    @theme.update!(status: :failed, error_message: e.message)
    false
  end

  private

  # Smart-crop to exactly width×height and re-encode as JPEG (SPEC.md §6.3).
  def resize(bytes, width, height)
    image = Vips::Image.thumbnail_buffer(bytes, width, height: height, crop: :attention)
    image.jpegsave_buffer(Q: 90)
  end

  def attach(attachment_name, bytes, canvas)
    @theme.public_send(attachment_name).attach(
      io: StringIO.new(bytes),
      filename: "#{canvas}.jpeg",
      content_type: "image/jpeg"
    )
  end

  def dimension(config, axis)
    Integer(ENV.fetch(config[:"#{axis}_env"], config[:"default_#{axis}"]))
  end
end
