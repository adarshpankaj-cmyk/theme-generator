# frozen_string_literal: true

require "rails_helper"

RSpec.describe BlendUpdaterService do
  let(:theme) { Theme.create!(name: "Ganesh", slug: "ganesh", tint_hex: "#FEF5E9") }
  let(:a4_ids) { TemplateRegistry.all.select(&:a4?).map(&:id) }
  let(:a5_ids) { TemplateRegistry.all.select(&:a5?).map(&:id) }

  def opacity_for(template_id)
    theme.reload.blend_overrides.dig(template_id, "artwork_opacity")
  end

  describe "artwork opacity (canvas-scoped)" do
    it "writes the opacity to every template on the edited template's canvas" do
      described_class.new(theme, "theme_one", { "artwork_opacity" => 0.42 }).call

      expect(a4_ids.map { |id| opacity_for(id) }).to all(eq(0.42))
      expect(a5_ids.map { |id| opacity_for(id) }).to all(be_nil)
    end

    it "editing an A5 template leaves A4 untouched" do
      described_class.new(theme, a5_ids.first, { "artwork_opacity" => 0.2 }).call

      expect(a5_ids.map { |id| opacity_for(id) }).to all(eq(0.2))
      expect(a4_ids.map { |id| opacity_for(id) }).to all(be_nil)
    end

    it "returns recomputed CSS for the whole canvas, in registry order" do
      result = described_class.new(theme, "theme_one", { "artwork_opacity" => 0.42 }).call

      expect(result.map { |entry| entry[:template_id] }).to eq(a4_ids)
      expect(result).to all(include(css: include("opacity: 0.42;")))
    end

    it "coerces the param string to a number" do
      described_class.new(theme, "theme_one", { "artwork_opacity" => "0.25" }).call

      expect(opacity_for("theme_one")).to eq(0.25)
    end
  end

  describe "template-scoped attributes" do
    it "keeps tint on the edited template only" do
      result = described_class.new(theme, "theme_one", { "tint_hex" => "#ABCDEF" }).call

      expect(result.map { |entry| entry[:template_id] }).to eq(["theme_one"])
      expect(theme.reload.blend_overrides.dig("theme_one", "tint_hex")).to eq("#ABCDEF")
      expect(theme.blend_overrides.dig("theme_luxury", "tint_hex")).to be_nil
    end

    it "keeps strips on the edited template only" do
      described_class.new(
        theme, "theme_one", { "strips" => { ".page-footer" => { "enabled" => "false" } } }
      ).call

      expect(theme.reload.blend_overrides.dig("theme_one", "strips", ".page-footer", "enabled"))
        .to be(false)
      expect(theme.blend_overrides.dig("theme_luxury", "strips")).to be_nil
    end
  end

  it "fans out opacity and scopes tint within a single edit" do
    result = described_class.new(
      theme, "theme_one", { "artwork_opacity" => 0.3, "tint_hex" => "#ABCDEF" }
    ).call

    expect(result.map { |entry| entry[:template_id] }).to eq(a4_ids)
    expect(a4_ids.map { |id| opacity_for(id) }).to all(eq(0.3))
    expect(theme.blend_overrides.dig("theme_luxury", "tint_hex")).to be_nil
  end

  it "rejects an unknown template" do
    expect { described_class.new(theme, "nope", {}) }
      .to raise_error(TemplateRegistry::UnknownTemplateError)
  end
end
