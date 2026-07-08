# frozen_string_literal: true

require "rails_helper"

RSpec.describe ImageGenerationService do
  # A fake engine that returns the reference ganesh jpeg for every call, so we
  # exercise the real libvips post-processing without hitting OpenRouter.
  class FakeEngine < ImageEngine::Base
    def initialize(bytes)
      @bytes = bytes
    end

    def generate(prompt:)
      @bytes
    end
  end

  # An engine that always fails, to exercise the failure path.
  class ExplodingEngine < ImageEngine::Base
    def generate(prompt:)
      raise ImageEngine::Error, "provider unavailable"
    end
  end

  let(:theme) { Theme.create!(name: "Ganesh", prompt: "Ganesh silhouette") }
  let(:reference_bytes) { File.binread(ReferenceTheme::ROOT.join("images", "a4.jpeg")) }

  def dimensions(attachment)
    image = Vips::Image.new_from_buffer(attachment.blob.download, "")
    [image.width, image.height]
  end

  describe "on success" do
    around do |example|
      # Two variants keeps the suite fast while still exercising the multi-variant path.
      previous = ENV["IMAGE_VARIANT_COUNT"]
      ENV["IMAGE_VARIANT_COUNT"] = "2"
      example.run
    ensure
      ENV["IMAGE_VARIANT_COUNT"] = previous
    end

    before { described_class.new(theme, engine: FakeEngine.new(reference_bytes)).call }

    it "attaches N variants per canvas, each resized to exact canvas dimensions" do
      expect(theme.a4_variants.size).to eq(2)
      expect(theme.a5_variants.size).to eq(2)
      expect(dimensions(theme.a4_variants.first)).to eq([600, 848])
      expect(dimensions(theme.a5_variants.first)).to eq([1024, 724])
    end

    it "caches a tint per variant, selects variant 0, and marks the theme ready" do
      theme.reload
      expect(theme.status).to eq("ready")
      expect(theme.selected_variant).to eq(0)
      expect(theme.variant_tints.size).to eq(2)
      expect(theme.variant_tints).to all(match(/\A#[0-9A-F]{6}\z/))
      expect(theme.tint_hex).to eq(theme.variant_tints.first)
      expect(theme.error_message).to be_nil
    end
  end

  describe "on failure" do
    it "marks the theme failed with the error message and returns false" do
      result = described_class.new(theme, engine: ExplodingEngine.new).call
      expect(result).to be(false)
      expect(theme.reload.status).to eq("failed")
      expect(theme.error_message).to eq("provider unavailable")
    end
  end
end
