# frozen_string_literal: true

require "rails_helper"

RSpec.describe GenerateThemeImagesJob, type: :job do
  it "runs the image generation service for the theme" do
    theme = Theme.create!(name: "Ganesh")
    service = instance_double(ImageGenerationService, call: true)
    allow(ImageGenerationService).to receive(:new).with(theme).and_return(service)

    described_class.perform_now(theme.id)

    expect(ImageGenerationService).to have_received(:new).with(theme)
    expect(service).to have_received(:call)
  end
end
