# frozen_string_literal: true

require "rails_helper"

RSpec.describe CssAssemblerService do
  # A theme whose slug/tint/opacity match the reference ganesh theme, so its
  # assembled CSS must equal the reference byte-for-byte after normalization.
  let(:ganesh) do
    Theme.new(
      name: "Ganesh Ji",
      slug: "ganesh",
      tint_hex: "#FEF5E9",
      artwork_opacity: 0.35,
      blend_overrides: {}
    )
  end

  describe "the golden test (F3 — the important one)" do
    TemplateRegistry.ids.each do |template_id|
      it "assembles #{template_id} to match the normalized reference CSS" do
        assembled = described_class.new(ganesh, template_id).call
        reference = described_class.normalize(File.read(ReferenceTheme.css_path(template_id)))
        expect(assembled).to eq(reference)
      end
    end
  end

  describe "the assembled output shape" do
    subject(:css) { described_class.new(ganesh, "theme_luxury").call }

    it "always includes the transform line" do
      expect(css).to include("transform: translate(0%, 0%) scale(1);")
    end

    it "always forces mix-blend-mode !important" do
      expect(css).to include("mix-blend-mode: multiply !important;")
      expect(css).not_to match(/mix-blend-mode: multiply;/)
    end

    it "has no trailing whitespace on any line and no leading/trailing blank lines" do
      expect(css).not_to match(/[ \t]+$/)
      expect(css).to start_with("body {")
      expect(css).to end_with("}")
    end

    it "points the background image at flash-themes/<slug>/images/<canvas>.jpeg" do
      expect(css).to include('url("./flash-themes/ganesh/images/a4.jpeg")')
    end
  end

  describe "effective value resolution (§4.1)" do
    it "prefers a template-level opacity override over the theme default" do
      ganesh.blend_overrides = { "theme_luxury" => { "artwork_opacity" => 0.5 } }
      css = described_class.new(ganesh, "theme_luxury").call
      expect(css).to include("opacity: 0.5;")
    end

    it "prefers a template-level tint override over the theme default" do
      ganesh.blend_overrides = { "theme_luxury" => { "tint_hex" => "#FFF5DA" } }
      css = described_class.new(ganesh, "theme_luxury").call
      # #FFF5DA => 255, 245, 218, carried at the effective opacity (0.35).
      expect(css).to include("background-color: rgba(255, 245, 218, 0.35) !important;")
    end

    it "fades the shared strip tint with the artwork opacity (whole-overlay fade)" do
      ganesh.blend_overrides = { "theme_luxury" => { "artwork_opacity" => 0.5 } }
      css = described_class.new(ganesh, "theme_luxury").call
      expect(css).to include("opacity: 0.5;")
      expect(css).to include("background-color: rgba(254, 245, 233, 0.5) !important;")
    end
  end

  describe "blend mode (§7)" do
    it "defaults to multiply" do
      css = described_class.new(ganesh, "theme_luxury").call
      expect(css).to include("mix-blend-mode: multiply !important;")
    end

    it "applies a template-level blend_mode override to every strip rule" do
      ganesh.blend_overrides = { "theme_luxury" => { "blend_mode" => "screen" } }
      css = described_class.new(ganesh, "theme_luxury").call
      expect(css).to include("mix-blend-mode: screen !important;")
      expect(css).not_to match(/mix-blend-mode: multiply/)
    end
  end

  describe "blend editor — strip overrides (§7)" do
    it "omits a disabled strip's selector from the CSS" do
      ganesh.blend_overrides = {
        "theme_one" => { "strips" => { ".page-footer" => { "enabled" => false } } }
      }
      css = described_class.new(ganesh, "theme_one").call
      expect(css).not_to include(".page-footer")
      expect(css).to include(".title-bill-ship-to")
    end

    it "emits a customized strip as its own rgba(...) rule with opacity-scaled alpha" do
      ganesh.blend_overrides = {
        "theme_one" => {
          "strips" => {
            ".items-table-header" => { "enabled" => true, "tint_hex" => "#F3E4C7", "alpha" => 0.8 }
          }
        }
      }
      css = described_class.new(ganesh, "theme_one").call
      # #F3E4C7 => 243, 228, 199; rendered alpha = opacity 0.35 × strip alpha 0.8 = 0.28.
      expect(css).to include(".items-table-header {\n  background-color: rgba(243, 228, 199, 0.28) !important;")
      # the customized selector is no longer in the shared rule's selector list
      expect(css).not_to match(/\.items-table-header,\n.*background-color: rgba\(254, 245, 233/m)
    end

    it "renders a tint-only custom strip at the full effective opacity" do
      ganesh.blend_overrides = {
        "theme_one" => {
          "strips" => { ".items-table-header" => { "tint_hex" => "#F3E4C7" } }
        }
      }
      css = described_class.new(ganesh, "theme_one").call
      # No per-strip alpha → multiplier 1 → rendered alpha == effective opacity (0.35).
      expect(css).to include(".items-table-header {\n  background-color: rgba(243, 228, 199, 0.35) !important;")
    end
  end
end
