# frozen_string_literal: true

require "faraday/multipart"
require "tmpdir"

# PublishService — packages the assembled theme folder and hands it off to
# myBillbook's existing API, then marks the theme published (F5, SPEC.md §5/§8).
# We build the handoff, not that API.
#
# [NEED] The exact myBillbook publish contract — URL, payload shape, auth
# (SPEC.md §10.3). Default here: multipart POST of the zipped folder plus `slug`
# and `name` fields, Bearer-token auth. Adjust `#build_payload` once the real
# contract is known; nothing else depends on the shape.
class PublishService
  class Error < StandardError; end

  def initialize(theme,
                 url: ENV["PUBLISH_API_URL"],
                 token: ENV["PUBLISH_API_TOKEN"],
                 connection: nil)
    @theme = theme
    @url = url
    @token = token
    @connection = connection
  end

  # @return [Theme] the published theme.
  # @raise [Error] if unconfigured or the API rejects the handoff.
  def call
    raise Error, "PUBLISH_API_URL is not configured" if @url.blank?

    Dir.mktmpdir do |dir|
      zip_path = File.join(dir, "#{@theme.slug}.zip")
      ThemePackagerService.new(@theme).zip(zip_path)
      response = post(zip_path)
      unless response.success?
        raise Error, "Publish failed (HTTP #{response.status}): #{response.body}"
      end
    end

    @theme.update!(status: :published)
    @theme
  end

  private

  def post(zip_path)
    connection.post("") do |req|
      req.headers["Authorization"] = "Bearer #{@token}" if @token.present?
      req.body = build_payload(zip_path)
    end
  end

  # [NEED: confirm shape] The folder handed off as a zip, with identifying fields.
  def build_payload(zip_path)
    {
      "slug" => @theme.slug,
      "name" => @theme.name,
      "file" => Faraday::Multipart::FilePart.new(zip_path, "application/zip", "#{@theme.slug}.zip")
    }
  end

  def connection
    @connection ||= Faraday.new(url: @url) do |f|
      f.request :multipart
      f.request :url_encoded
      f.adapter Faraday.default_adapter
    end
  end
end
