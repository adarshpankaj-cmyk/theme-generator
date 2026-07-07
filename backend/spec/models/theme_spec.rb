# frozen_string_literal: true

require "rails_helper"

RSpec.describe Theme, type: :model do
  describe ".slugify" do
    it "lowercases, replaces non-alnum with underscore, collapses and strips" do
      expect(described_class.slugify("Ganesh Ji")).to eq("ganesh_ji")
      expect(described_class.slugify("  Maharashtra!!  ")).to eq("maharashtra")
      expect(described_class.slugify("Diwali -- 2025")).to eq("diwali_2025")
    end
  end

  describe "slug assignment on create" do
    it "derives the slug from the name" do
      theme = described_class.create!(name: "Ganesh Ji", tint_hex: "#FEF5E9")
      expect(theme.slug).to eq("ganesh_ji")
    end

    it "keeps an explicitly provided slug" do
      theme = described_class.create!(name: "Ganesh Ji", slug: "ganesh")
      expect(theme.slug).to eq("ganesh")
    end

    it "appends a numeric suffix on collision to stay unique" do
      described_class.create!(name: "Ganesh")
      second = described_class.create!(name: "Ganesh")
      expect(second.slug).to eq("ganesh_2")
    end
  end

  describe "validations" do
    it "requires a name" do
      expect(described_class.new(slug: "x")).not_to be_valid
    end

    it "rejects opacity outside 0..1" do
      expect(described_class.new(name: "x", artwork_opacity: 1.5)).not_to be_valid
    end

    it "rejects an unknown status" do
      theme = described_class.new(name: "x", status: "bogus")
      expect(theme).not_to be_valid
      expect(theme.errors[:status]).to be_present
    end
  end

  describe "defaults" do
    it "starts as draft with 0.6 opacity and empty overrides" do
      theme = described_class.create!(name: "Ganesh")
      expect(theme.status).to eq("draft")
      expect(theme.artwork_opacity).to eq(0.6)
      expect(theme.blend_overrides).to eq({})
    end
  end

  describe "#overrides_for" do
    it "returns the template's override hash, or {} when absent" do
      theme = described_class.new(
        name: "Ganesh",
        blend_overrides: { "theme_one" => { "artwork_opacity" => 0.3 } }
      )
      expect(theme.overrides_for("theme_one")).to eq("artwork_opacity" => 0.3)
      expect(theme.overrides_for("theme_two")).to eq({})
    end
  end

  describe "image attachments" do
    it "supports A4 and A5 attachments" do
      theme = described_class.create!(name: "Ganesh")
      expect(theme).to respond_to(:a4_image)
      expect(theme).to respond_to(:a5_image)
    end
  end
end
