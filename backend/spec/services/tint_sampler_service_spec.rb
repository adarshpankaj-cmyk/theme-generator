# frozen_string_literal: true

require "rails_helper"

RSpec.describe TintSamplerService do
  # Convert "#RRGGBB" → [hue, saturation, lightness] to assert the §5 targets.
  def hsl(hex)
    r, g, b = hex.delete("#").scan(/../).map { |c| c.to_i(16) / 255.0 }
    max = [r, g, b].max
    min = [r, g, b].min
    l = (max + min) / 2.0
    s = max == min ? 0.0 : (l > 0.5 ? (max - min) / (2.0 - max - min) : (max - min) / (max + min))
    [r, g, b, s, l]
  end

  it "produces a barely-tinted warm white from the ganesh artwork (§5 / §11)" do
    bytes = File.binread(ReferenceTheme::ROOT.join("images", "a4.jpeg"))
    hex = described_class.new(bytes).call

    expect(hex).to match(/\A#[0-9A-F]{6}\z/)
    r, g, b, saturation, lightness = hsl(hex)
    expect(lightness).to be >= 0.9   # near-white
    expect(saturation).to be <= 0.21 # low saturation (capped at 0.20)
    expect(r).to be >= g
    expect(g).to be >= b             # warm (hue toward orange)
  end
end
