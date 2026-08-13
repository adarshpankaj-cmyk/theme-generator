# frozen_string_literal: true

require "rails_helper"

RSpec.describe ArtworkUploadService do
  let(:theme) { Theme.create!(name: "Independence Day") }
  let(:source_path) { ReferenceTheme::ROOT.join("images", "a4.jpeg") }

  def upload(path: source_path, content_type: "image/jpeg")
    Rack::Test::UploadedFile.new(path.to_s, content_type)
  end

  def dimensions(attachment)
    image = Vips::Image.new_from_buffer(attachment.blob.download, "")
    [image.width, image.height]
  end

  describe "on success" do
    before { described_class.new(theme, upload).call }

    it "attaches one variant per canvas, each cropped to exact canvas dimensions" do
      expect(theme.a4_variants.size).to eq(1)
      expect(theme.a5_variants.size).to eq(1)
      expect(dimensions(theme.a4_variants.first)).to eq([600, 848])
      expect(dimensions(theme.a5_variants.first)).to eq([1024, 724])
    end

    it "samples the tint from the uploaded artwork and marks the theme ready" do
      theme.reload
      expect(theme.status).to eq("ready")
      expect(theme.selected_variant).to eq(0)
      expect(theme.variant_tints.size).to eq(1)
      expect(theme.tint_hex).to match(/\A#[0-9A-F]{6}\z/)
      expect(theme.tint_hex).to eq(theme.variant_tints.first)
      expect(theme.error_message).to be_nil
    end
  end

  it "replaces prior artwork rather than appending variants" do
    described_class.new(theme, upload).call
    described_class.new(theme, upload).call

    expect(theme.reload.a4_variants.size).to eq(1)
    expect(theme.a5_variants.size).to eq(1)
  end

  it "accepts a PNG upload" do
    png = Tempfile.new(["artwork", ".png"], binmode: true)
    png.write(Vips::Image.black(400, 500).add(120).cast(:uchar).pngsave_buffer)
    png.rewind

    described_class.new(theme, upload(path: Pathname.new(png.path), content_type: "image/png")).call

    expect(theme.reload.status).to eq("ready")
  ensure
    png&.close!
  end

  describe "validation" do
    it "rejects a missing image" do
      expect { described_class.new(theme, nil).call }
        .to raise_error(described_class::InvalidImageError, /required/)
    end

    it "rejects an unsupported content type" do
      expect { described_class.new(theme, upload(content_type: "application/pdf")).call }
        .to raise_error(described_class::InvalidImageError, /unsupported image type/)
    end

    it "rejects bytes that are not a decodable image" do
      text = Tempfile.new(["not-an-image", ".png"], binmode: true)
      text.write("this is definitely not a png")
      text.rewind

      expect do
        described_class.new(theme, upload(path: Pathname.new(text.path), content_type: "image/png")).call
      end.to raise_error(described_class::InvalidImageError, /could not read image/)
    ensure
      text&.close!
    end

    it "leaves existing artwork intact when the new upload is unreadable" do
      described_class.new(theme, upload).call
      original_blob_id = theme.a4_variants.first.blob_id

      corrupt = Tempfile.new(["corrupt", ".png"], binmode: true)
      corrupt.write("nope")
      corrupt.rewind

      expect do
        described_class.new(theme, upload(path: Pathname.new(corrupt.path), content_type: "image/png")).call
      end.to raise_error(described_class::InvalidImageError)

      expect(theme.reload.a4_variants.first.blob_id).to eq(original_blob_id)
      expect(theme.status).to eq("ready")
    ensure
      corrupt&.close!
    end
  end
end
