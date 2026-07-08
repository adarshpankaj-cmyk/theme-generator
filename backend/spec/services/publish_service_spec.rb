# frozen_string_literal: true

require "rails_helper"

RSpec.describe PublishService do
  let(:theme) do
    Theme.create!(name: "Ganesh Ji", slug: "ganesh", tint_hex: "#FEF5E9", status: :ready).tap do |t|
      t.a4_images.attach(io: File.open(ReferenceTheme::ROOT.join("images", "a4.jpeg")),
                         filename: "a4_0.jpeg", content_type: "image/jpeg")
      t.a5_images.attach(io: File.open(ReferenceTheme::ROOT.join("images", "a5.jpeg")),
                         filename: "a5_0.jpeg", content_type: "image/jpeg")
    end
  end

  # A mock publish endpoint that records the request it receives.
  def mock_connection(status:)
    Faraday.new(url: "https://mock.test/publish") do |f|
      f.request :multipart
      f.request :url_encoded
      f.adapter :test do |stub|
        stub.post("/publish") { |env| @recorded = env; [status, {}, "ok"] }
      end
    end
  end

  describe "on success" do
    it "POSTs the zipped folder and flips the theme to published" do
      service = described_class.new(theme, url: "https://mock.test/publish", token: "secret",
                                          connection: mock_connection(status: 200))
      service.call

      expect(theme.reload.status).to eq("published")
      expect(@recorded.request_headers["Authorization"]).to eq("Bearer secret")

      body = @recorded.request_body
      body = body.read if body.respond_to?(:read)
      expect(body).to include("ganesh.zip", "application/zip")
    end
  end

  describe "when the endpoint rejects the handoff" do
    it "raises and leaves the theme unpublished" do
      service = described_class.new(theme, url: "https://mock.test/publish",
                                          connection: mock_connection(status: 500))
      expect { service.call }.to raise_error(PublishService::Error, /HTTP 500/)
      expect(theme.reload.status).to eq("ready")
    end
  end

  describe "when unconfigured" do
    it "raises a clear error" do
      service = described_class.new(theme, url: nil)
      expect { service.call }.to raise_error(PublishService::Error, /not configured/)
    end
  end
end
