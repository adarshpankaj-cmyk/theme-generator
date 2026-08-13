# frozen_string_literal: true

require "rails_helper"

RSpec.describe ThemePackagerService do
  let(:theme) do
    Theme.create!(name: "Ganesh Ji", slug: "ganesh", tint_hex: "#FEF5E9", artwork_opacity: 0.35).tap do |t|
      t.a4_images.attach(io: File.open(ReferenceTheme::ROOT.join("images", "a4.jpeg")),
                         filename: "a4_0.jpeg", content_type: "image/jpeg")
      t.a5_images.attach(io: File.open(ReferenceTheme::ROOT.join("images", "a5.jpeg")),
                         filename: "a5_0.jpeg", content_type: "image/jpeg")
    end
  end

  around do |example|
    Dir.mktmpdir { |dir| @tmp = dir; example.run }
  end

  # Relative paths (excluding the .overlay_name flag file) the folder must contain.
  def relative_paths(root)
    Dir.glob(File.join(root, "**", "*"), File::FNM_DOTMATCH)
       .reject { |p| File.directory?(p) }
       .map { |p| p.sub("#{root}/", "") }
       .sort
  end

  describe "overlay_name" do
    it "defaults to the theme's slug" do
      expect(described_class.new(theme).overlay_name).to eq("ganesh")
    end

    it "slugifies a requested name" do
      expect(described_class.new(theme, overlay_name: "Azadi 2026!").overlay_name)
        .to eq("azadi_2026")
    end

    it "falls back to the slug when the requested name is blank" do
      expect(described_class.new(theme, overlay_name: "  ").overlay_name).to eq("ganesh")
    end

    it "rejects a name with no usable characters" do
      expect { described_class.new(theme, overlay_name: "!!!") }
        .to raise_error(described_class::InvalidNameError)
    end

    it "cannot be used to escape the package directory" do
      expect(described_class.new(theme, overlay_name: "../../etc/passwd").overlay_name)
        .to eq("etc_passwd")
    end
  end

  describe "#build with a custom overlay name" do
    let(:root) { described_class.new(theme, overlay_name: "Azadi 2026").build(@tmp) }

    it "names the folder and .overlay_name after the requested name" do
      expect(File.basename(root)).to eq("azadi_2026")
      expect(File.read(File.join(root, ".overlay_name"))).to eq("azadi_2026")
    end

    it "points every stylesheet's artwork url at the renamed folder" do
      TemplateRegistry.ids.each do |template_id|
        css = File.read(File.join(root, "css", template_id, "latest.css"))
        expect(css).to include("./flash-themes/azadi_2026/images/")
        expect(css).not_to include("flash-themes/ganesh/")
      end
    end

    it "keeps the reference image basenames" do
      expect(relative_paths(root)).to include("images/a4.jpeg", "images/a5.jpeg")
    end
  end

  describe "#build" do
    let(:root) { described_class.new(theme).build(@tmp) }

    it "builds the folder under the slug name" do
      expect(File.basename(root)).to eq("ganesh")
    end

    it "writes .overlay_name as the slug with no trailing newline" do
      contents = File.read(File.join(root, ".overlay_name"))
      expect(contents).to eq("ganesh")
      expect(contents).not_to end_with("\n")
    end

    it "produces the exact folder shape of the reference theme" do
      expected = %w[
        .overlay_name
        images/a4.jpeg
        images/a5.jpeg
        css/theme_luxury/latest.css
        css/theme_one/latest.css
        css/theme_two/latest.css
        css/theme_three/latest.css
        css/theme_four/latest.css
        css/theme_five/latest.css
        css/theme_six/latest.css
        css/theme_seven/latest.css
        css/theme_eight/latest.css
      ].sort
      expect(relative_paths(root)).to eq(expected)
    end

    it "writes the two artwork images matching the reference bytes" do
      %w[a4 a5].each do |canvas|
        built = File.binread(File.join(root, "images", "#{canvas}.jpeg"))
        reference = File.binread(ReferenceTheme::ROOT.join("images", "#{canvas}.jpeg"))
        expect(built).to eq(reference)
      end
    end

    it "writes each latest.css equal to the normalized reference" do
      TemplateRegistry.ids.each do |template_id|
        built = File.read(File.join(root, "css", template_id, "latest.css"))
        reference = CssAssemblerService.normalize(File.read(ReferenceTheme.css_path(template_id)))
        expect(built).to eq(reference), "mismatch in css/#{template_id}/latest.css"
      end
    end
  end

  describe "selected variant" do
    it "packages the selected variant's artwork, not variant 0" do
      # Attach a distinct second A4 variant (reuse the a5 bytes as stand-in) and select it.
      variant1 = ReferenceTheme::ROOT.join("images", "a5.jpeg")
      theme.a4_images.attach(io: File.open(variant1), filename: "a4_1.jpeg", content_type: "image/jpeg")
      theme.update!(selected_variant: 1)

      root = described_class.new(theme).build(@tmp)
      built = File.binread(File.join(root, "images", "a4.jpeg"))
      expect(built).to eq(File.binread(variant1))
    end
  end

  describe "#zip" do
    it "packages the whole folder, keeping the slug prefix" do
      zip_path = File.join(@tmp, "ganesh.zip")
      described_class.new(theme).zip(zip_path)

      entries = []
      Zip::File.open(zip_path) { |zf| zf.each { |e| entries << e.name } }
      expect(entries).to include(
        "ganesh/.overlay_name",
        "ganesh/images/a4.jpeg",
        "ganesh/images/a5.jpeg",
        "ganesh/css/theme_luxury/latest.css",
        "ganesh/css/theme_eight/latest.css"
      )
    end
  end
end
