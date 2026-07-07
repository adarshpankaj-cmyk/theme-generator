# frozen_string_literal: true

require "rails_helper"

RSpec.describe ThemePackagerService do
  let(:theme) do
    Theme.create!(name: "Ganesh Ji", slug: "ganesh", tint_hex: "#FEF5E9", artwork_opacity: 0.35).tap do |t|
      t.a4_image.attach(io: File.open(ReferenceTheme::ROOT.join("images", "a4.jpeg")),
                        filename: "a4.jpeg", content_type: "image/jpeg")
      t.a5_image.attach(io: File.open(ReferenceTheme::ROOT.join("images", "a5.jpeg")),
                        filename: "a5.jpeg", content_type: "image/jpeg")
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
