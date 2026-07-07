# frozen_string_literal: true

require "base64"

module ImageEngine
  # OpenRouter image-generation engine (F2, SPEC.md §6.2). Requests image output
  # via `modalities: ["image", "text"]` and extracts the returned base64 image
  # from choices[0].message.images[]. Model + key come from config/env.
  class OpenRouter < Base
    DEFAULT_BASE_URL = "https://openrouter.ai/api/v1"
    DEFAULT_MODEL = "google/gemini-2.5-flash-image"

    def initialize(api_key: ENV["OPENROUTER_API_KEY"],
                   base_url: ENV.fetch("OPENROUTER_BASE_URL", DEFAULT_BASE_URL),
                   model: ENV.fetch("OPENROUTER_MODEL", DEFAULT_MODEL),
                   connection: nil)
      @api_key = api_key
      @base_url = base_url
      @model = model
      @connection = connection
    end

    # @param prompt [String]
    # @return [String] raw image bytes.
    def generate(prompt:)
      raise Error, "OPENROUTER_API_KEY is not set" if @api_key.blank?

      response = connection.post("chat/completions") do |req|
        req.headers["Authorization"] = "Bearer #{@api_key}"
        req.body = {
          model: @model,
          modalities: %w[image text],
          messages: [{ role: "user", content: prompt }]
        }
      end

      raise Error, "OpenRouter returned #{response.status}: #{response.body}" unless response.success?

      decode_image(JSON.parse(response.body))
    end

    private

    # Encodes the request as JSON; the response is parsed manually after the
    # status check so a non-JSON error body doesn't mask the real HTTP error.
    def connection
      @connection ||= Faraday.new(url: @base_url) do |f|
        f.request :json
        f.adapter Faraday.default_adapter
      end
    end

    # Pull the first image out of the assistant message and decode it. Tolerant
    # of the data-URL wrapper (data:image/png;base64,....) and bare base64.
    # @return [String] raw image bytes.
    def decode_image(body)
      image = body.dig("choices", 0, "message", "images", 0)
      url = image.is_a?(Hash) ? image.dig("image_url", "url") || image["url"] : image
      raise Error, "No image in OpenRouter response: #{body.inspect}" if url.blank?

      Base64.decode64(url.sub(/\Adata:[^,]*,/, ""))
    end
  end
end
