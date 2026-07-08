# frozen_string_literal: true

require "vips"
require "stringio"
require "concurrent"

# ImageGenerationService — generates the artwork candidates for a theme (F2).
# For each canvas it produces N variants: it builds a guardrail-wrapped prompt,
# calls the image engine, and smart-crops each result to exact px with libvips.
# All N×2 engine calls run in a bounded thread pool (HTTP is IO-bound). When every
# call succeeds it attaches the images in variant order, caches each variant's tint
# (§5), selects variant 0, and marks the theme ready; on any failure it marks the
# theme failed. See SPEC.md §6.
class ImageGenerationService
  # canvas => { attachment, and the ENV keys / defaults for exact dimensions }.
  CANVASES = {
    "a4" => { attachment: :a4_images, width_env: "A4_WIDTH", height_env: "A4_HEIGHT",
              default_width: 600, default_height: 848 },
    "a5" => { attachment: :a5_images, width_env: "A5_WIDTH", height_env: "A5_HEIGHT",
              default_width: 1024, default_height: 724 }
  }.freeze

  DEFAULT_VARIANT_COUNT = 4
  DEFAULT_CONCURRENCY = 4

  def initialize(theme, engine: ImageEngine::OpenRouter.new)
    @theme = theme
    @engine = engine
    @prompt_builder = PromptBuilder.new(theme.prompt)
  end

  # Run the full generation. Returns true on success, false on handled failure.
  # @return [Boolean]
  def call
    purge_existing
    processed = generate_all # { "a4" => [bytes, …], "a5" => [bytes, …] } in variant order
    attach_variants(processed)

    tints = processed.fetch("a4").map { |bytes| TintSamplerService.new(bytes).call }
    @theme.update!(
      variant_tints: tints,
      selected_variant: 0,
      tint_hex: tints.first,
      status: :ready,
      error_message: nil
    )
    true
  rescue StandardError => e
    @theme.update!(status: :failed, error_message: e.message)
    false
  end

  private

  def variant_count
    Integer(ENV.fetch("IMAGE_VARIANT_COUNT", DEFAULT_VARIANT_COUNT))
  end

  def concurrency
    Integer(ENV.fetch("IMAGE_GEN_CONCURRENCY", DEFAULT_CONCURRENCY))
  end

  # Detach any images from a prior generation so regenerate doesn't accumulate.
  def purge_existing
    @theme.a4_images.purge if @theme.a4_images.attached?
    @theme.a5_images.purge if @theme.a5_images.attached?
  end

  # Generate every (canvas, variant) image concurrently and return the processed
  # JPEG bytes grouped by canvas, in variant order. Raises the first engine error.
  def generate_all
    jobs = CANVASES.keys.product((0...variant_count).to_a)
    pool = Concurrent::FixedThreadPool.new([concurrency, jobs.size].min)
    results = Concurrent::Hash.new
    errors = Concurrent::Array.new

    futures = jobs.map do |canvas, index|
      Concurrent::Future.execute(executor: pool) do
        config = CANVASES.fetch(canvas)
        raw = @engine.generate(prompt: @prompt_builder.for_canvas(canvas))
        results[[canvas, index]] = resize(raw, dimension(config, :width), dimension(config, :height))
      rescue StandardError => e
        errors << e
      end
    end

    futures.each(&:wait)
    pool.shutdown
    pool.wait_for_termination
    raise errors.first if errors.any?

    CANVASES.keys.index_with do |canvas|
      (0...variant_count).map { |index| results.fetch([canvas, index]) }
    end
  end

  # Attach each canvas's variants in order so attachment id order == variant index.
  def attach_variants(processed)
    CANVASES.each do |canvas, config|
      processed.fetch(canvas).each_with_index do |bytes, index|
        @theme.public_send(config[:attachment]).attach(
          io: StringIO.new(bytes),
          filename: "#{canvas}_#{index}.jpeg",
          content_type: "image/jpeg"
        )
      end
    end
  end

  # Smart-crop to exactly width×height and re-encode as JPEG (SPEC.md §6.3).
  def resize(bytes, width, height)
    image = Vips::Image.thumbnail_buffer(bytes, width, height: height, crop: :attention)
    image.jpegsave_buffer(Q: 90)
  end

  def dimension(config, axis)
    Integer(ENV.fetch(config[:"#{axis}_env"], config[:"default_#{axis}"]))
  end
end
