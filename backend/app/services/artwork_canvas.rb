# frozen_string_literal: true

require "vips"

# ArtworkCanvas — the two invoice canvases a theme's artwork is produced for
# (A4 portrait, A5 landscape) and the shared smart-crop that fits any source
# image to one of them at exact pixel size.
#
# Shared by ImageGenerationService (model-generated artwork) and
# ArtworkUploadService (user-supplied artwork) so both paths agree on canvas
# dimensions and encoding. See SPEC.md §6.3.
module ArtworkCanvas
  # canvas id => { attachment association on Theme, ENV keys / defaults for px }.
  SPECS = {
    "a4" => { attachment: :a4_images, width_env: "A4_WIDTH", height_env: "A4_HEIGHT",
              default_width: 600, default_height: 848 },
    "a5" => { attachment: :a5_images, width_env: "A5_WIDTH", height_env: "A5_HEIGHT",
              default_width: 1024, default_height: 724 }
  }.freeze

  IDS = SPECS.keys.freeze
  JPEG_QUALITY = 90

  module_function

  # @param canvas [String] "a4" or "a5"
  # @return [Hash] the canvas spec
  def spec(canvas)
    SPECS.fetch(canvas)
  end

  # @param canvas [String]
  # @return [Symbol] the has_many_attached association holding this canvas's variants.
  def attachment_name(canvas)
    spec(canvas).fetch(:attachment)
  end

  # Exact pixel size for a canvas; ENV-overridable so the packaged artwork can be
  # retuned without a code change.
  # @param canvas [String]
  # @return [Array(Integer, Integer)] [width, height]
  def dimensions(canvas)
    config = spec(canvas)
    [
      Integer(ENV.fetch(config[:width_env], config[:default_width])),
      Integer(ENV.fetch(config[:height_env], config[:default_height]))
    ]
  end

  # Smart-crop arbitrary image bytes to exactly the canvas size and re-encode as
  # JPEG. `crop: :attention` keeps the visually salient region when the source
  # aspect ratio differs from the canvas.
  # @param bytes [String] raw source image bytes
  # @param canvas [String]
  # @return [String] JPEG bytes at exactly the canvas dimensions
  # @raise [Vips::Error] if the bytes are not a decodable image
  def fit(bytes, canvas)
    width, height = dimensions(canvas)
    Vips::Image
      .thumbnail_buffer(bytes, width, height: height, crop: :attention)
      .jpegsave_buffer(Q: JPEG_QUALITY)
  end
end
