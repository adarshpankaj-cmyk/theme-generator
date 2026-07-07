# frozen_string_literal: true

require "rails_helper"
require "base64"

RSpec.describe ImageEngine::OpenRouter do
  # Build an injected Faraday connection backed by the test adapter.
  def connection_for(status:, body:)
    Faraday.new do |f|
      f.request :json
      f.adapter :test do |stub|
        stub.post("chat/completions") { [status, { "Content-Type" => "application/json" }, body] }
      end
    end
  end

  let(:image_bytes) { "\xFF\xD8\xFFrawjpegbytes".b }
  let(:data_url) { "data:image/png;base64,#{Base64.strict_encode64(image_bytes)}" }

  it "decodes the base64 image from choices[0].message.images[]" do
    body = { "choices" => [{ "message" => { "images" => [{ "image_url" => { "url" => data_url } }] } }] }.to_json
    engine = described_class.new(api_key: "test-key", connection: connection_for(status: 200, body: body))

    expect(engine.generate(prompt: "anything")).to eq(image_bytes)
  end

  it "raises when the API key is missing" do
    engine = described_class.new(api_key: nil)
    expect { engine.generate(prompt: "x") }.to raise_error(ImageEngine::Error, /OPENROUTER_API_KEY/)
  end

  it "raises on a non-success response" do
    engine = described_class.new(api_key: "k", connection: connection_for(status: 500, body: "boom"))
    expect { engine.generate(prompt: "x") }.to raise_error(ImageEngine::Error, /500/)
  end

  it "raises when the response carries no image" do
    body = { "choices" => [{ "message" => { "content" => "sorry, no image" } }] }.to_json
    engine = described_class.new(api_key: "k", connection: connection_for(status: 200, body: body))
    expect { engine.generate(prompt: "x") }.to raise_error(ImageEngine::Error, /No image/)
  end
end
