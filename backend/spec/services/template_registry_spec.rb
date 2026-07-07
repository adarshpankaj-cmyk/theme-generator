# frozen_string_literal: true

require "rails_helper"

# F1 verification: the registry must be a faithful, ordered mirror of the
# reference theme's CSS. If the registry ever drifts from ground truth, the
# deterministic CSS assembler (F3) would silently produce wrong output — so we
# assert the registry against the reference ganesh CSS directly.
RSpec.describe TemplateRegistry do
  let(:reference_ids) do
    %w[theme_luxury theme_one theme_two theme_three theme_four
       theme_five theme_six theme_seven theme_eight]
  end

  describe ".ids" do
    it "registers exactly the nine reference templates" do
      expect(described_class.ids).to contain_exactly(*reference_ids)
    end

    it "preserves registry (file) order" do
      expect(described_class.ids).to eq(reference_ids)
    end
  end

  describe ".all" do
    it "returns a Template for every id" do
      expect(described_class.all.map(&:id)).to eq(described_class.ids)
      expect(described_class.all).to all(be_a(TemplateRegistry::Template))
    end
  end

  describe "each template matches the reference CSS (ground truth)" do
    it "has the same canvas as the reference file" do
      reference_ids.each do |id|
        expect(described_class.find(id).canvas)
          .to eq(ReferenceTheme.canvas_for(id)), "canvas mismatch for #{id}"
      end
    end

    it "has the same selectors, in the same order, as the reference file" do
      reference_ids.each do |id|
        expect(described_class.find(id).selectors)
          .to eq(ReferenceTheme.selectors_for(id)), "selector mismatch for #{id}"
      end
    end

    it "uses the reference opacity default (0.35) for every template" do
      reference_ids.each do |id|
        expect(described_class.find(id).default_opacity).to eq(0.35)
      end
    end
  end

  describe "canvas assignment" do
    it "marks only theme_four and theme_six as A5" do
      a5 = described_class.all.select(&:a5?).map(&:id)
      expect(a5).to contain_exactly("theme_four", "theme_six")
    end

    it "marks every other template as A4" do
      a4 = described_class.all.select(&:a4?).map(&:id)
      expect(a4).to contain_exactly(
        "theme_luxury", "theme_one", "theme_two", "theme_three",
        "theme_five", "theme_seven", "theme_eight"
      )
    end
  end

  describe ".find" do
    it "raises UnknownTemplateError for an unregistered id" do
      expect { described_class.find("nope") }
        .to raise_error(TemplateRegistry::UnknownTemplateError, /Unknown template/)
    end

    it "accepts a symbol id" do
      expect(described_class.find(:theme_one).id).to eq("theme_one")
    end
  end

  describe "immutability" do
    it "freezes each template's selector list" do
      expect(described_class.find("theme_luxury").selectors).to be_frozen
    end
  end
end
