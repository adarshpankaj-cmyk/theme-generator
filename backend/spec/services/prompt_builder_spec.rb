# frozen_string_literal: true

require "rails_helper"

RSpec.describe PromptBuilder do
  subject(:builder) { described_class.new("Ganesh silhouette") }

  it "embeds the user prompt inside the readability guardrail" do
    prompt = builder.for_canvas("a4")
    expect(prompt).to include('themed: "Ganesh silhouette"')
    expect(prompt).to include("COMPOSITION (protects invoice text")
    expect(prompt).to include("NO text, letters, numbers, or logos")
  end

  it "uses the portrait orientation for A4" do
    expect(builder.for_canvas("a4")).to include("ORIENTATION: portrait, taller than wide.")
  end

  it "uses the landscape orientation for A5" do
    expect(builder.for_canvas("a5")).to include("ORIENTATION: landscape, wider than tall.")
  end

  it "raises for an unknown canvas" do
    expect { builder.for_canvas("a6") }.to raise_error(ArgumentError)
  end
end
