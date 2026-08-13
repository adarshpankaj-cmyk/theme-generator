# frozen_string_literal: true

require "stringio"

# ArtworkUploadService — makes a user-supplied image the theme's artwork,
# bypassing the image engine entirely.
#
# This is the manual counterpart to ImageGenerationService: instead of asking a
# model for N candidates, the uploaded file becomes the single artwork variant.
# It is smart-cropped to each canvas via ArtworkCanvas (so an upload is
# indistinguishable from generated artwork downstream), its tint is sampled the
# same way (§5), and the theme is marked ready.
class ArtworkUploadService
  # Raised for anything wrong with the upload itself; the API renders it as 422.
  class InvalidImageError < StandardError; end

  PERMITTED_CONTENT_TYPES = %w[image/png image/jpeg image/jpg image/webp].freeze
  MAX_BYTES = 15 * 1024 * 1024

  # @param theme [Theme]
  # @param upload [ActionDispatch::Http::UploadedFile] the `image` request part.
  def initialize(theme, upload)
    @theme = theme
    @upload = upload
  end

  # Replace the theme's artwork with the uploaded image and mark it ready.
  # @return [Theme] the updated theme
  # @raise [InvalidImageError] if the upload is missing, too large, of an
  #   unsupported type, or not a decodable image.
  def call
    bytes = read_upload

    # Crop for every canvas *before* touching the existing attachments, so a
    # bad upload can't leave the theme with its previous artwork destroyed.
    processed = ArtworkCanvas::IDS.index_with { |canvas| fit(bytes, canvas) }

    purge_existing
    attach(processed)

    tint = TintSamplerService.new(processed.fetch("a4")).call
    @theme.update!(
      variant_tints: [tint],
      selected_variant: 0,
      tint_hex: tint,
      status: :ready,
      error_message: nil
    )
    @theme
  end

  private

  # @return [String] the raw uploaded bytes
  def read_upload
    raise InvalidImageError, "image is required" if @upload.blank?
    unless @upload.respond_to?(:read)
      raise InvalidImageError, "image must be an uploaded file"
    end

    content_type = @upload.try(:content_type).to_s.split(";").first
    unless PERMITTED_CONTENT_TYPES.include?(content_type)
      raise InvalidImageError,
            "unsupported image type #{content_type.presence || 'unknown'} " \
            "(expected #{PERMITTED_CONTENT_TYPES.join(', ')})"
    end

    bytes = @upload.read.to_s.b
    raise InvalidImageError, "image is empty" if bytes.empty?
    if bytes.bytesize > MAX_BYTES
      raise InvalidImageError, "image is larger than #{MAX_BYTES / 1.megabyte}MB"
    end

    bytes
  end

  # Wrap decode failures so a corrupt file reads as a 422 rather than a 500.
  def fit(bytes, canvas)
    ArtworkCanvas.fit(bytes, canvas)
  rescue Vips::Error => e
    raise InvalidImageError, "could not read image: #{e.message.lines.first&.strip}"
  end

  # Drop any prior artwork so an upload replaces rather than appends variants.
  def purge_existing
    @theme.a4_images.purge if @theme.a4_images.attached?
    @theme.a5_images.purge if @theme.a5_images.attached?
  end

  # @param processed [Hash{String=>String}] canvas id => JPEG bytes
  def attach(processed)
    processed.each do |canvas, bytes|
      @theme.public_send(ArtworkCanvas.attachment_name(canvas)).attach(
        io: StringIO.new(bytes),
        filename: "#{canvas}_0.jpeg",
        content_type: "image/jpeg"
      )
    end
  end
end
