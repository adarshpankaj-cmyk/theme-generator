# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::Themes", type: :request do
  def attach_reference_images(theme)
    theme.a4_image.attach(io: File.open(ReferenceTheme::ROOT.join("images", "a4.jpeg")),
                          filename: "a4.jpeg", content_type: "image/jpeg")
    theme.a5_image.attach(io: File.open(ReferenceTheme::ROOT.join("images", "a5.jpeg")),
                          filename: "a5.jpeg", content_type: "image/jpeg")
  end

  describe "POST /api/themes" do
    it "creates a draft theme and returns the §8 shape" do
      post "/api/themes", params: { name: "Ganesh Ji", prompt: "Ganesh silhouette" }

      expect(response).to have_http_status(:created)
      body = response.parsed_body
      expect(body["slug"]).to eq("ganesh_ji")
      expect(body["status"]).to eq("draft")
      expect(body["templates"]).to eq(TemplateRegistry.ids)
      expect(body).to have_key("a4_image_url")
    end

    it "returns 422 when the name is missing" do
      post "/api/themes", params: { prompt: "x" }
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "GET /api/themes/:id" do
    it "returns the theme" do
      theme = Theme.create!(name: "Ganesh")
      get "/api/themes/#{theme.id}"
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["id"]).to eq(theme.id)
    end

    it "returns 404 for an unknown id" do
      get "/api/themes/999999"
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "POST /api/themes/:id/generate" do
    it "flips to generating and enqueues the image job" do
      theme = Theme.create!(name: "Ganesh")

      expect { post "/api/themes/#{theme.id}/generate" }
        .to have_enqueued_job(GenerateThemeImagesJob).with(theme.id)

      expect(response).to have_http_status(:accepted)
      expect(response.parsed_body["status"]).to eq("generating")
      expect(theme.reload.status).to eq("generating")
    end
  end

  describe "POST /api/themes/:id/regenerate" do
    it "updates the prompt and re-enqueues generation" do
      theme = Theme.create!(name: "Ganesh", prompt: "old")

      expect { post "/api/themes/#{theme.id}/regenerate", params: { prompt: "new prompt" } }
        .to have_enqueued_job(GenerateThemeImagesJob)

      expect(response).to have_http_status(:accepted)
      expect(theme.reload.prompt).to eq("new prompt")
    end
  end

  describe "PATCH /api/themes/:id/blend" do
    let(:theme) { Theme.create!(name: "Ganesh", slug: "ganesh", tint_hex: "#FEF5E9") }

    it "recomputes CSS and persists the override" do
      patch "/api/themes/#{theme.id}/blend", params: {
        template_id: "theme_one",
        strips: { ".page-footer" => { enabled: false } }
      }

      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body["template_id"]).to eq("theme_one")
      expect(body["css"]).not_to include(".page-footer")
      expect(theme.reload.blend_overrides.dig("theme_one", "strips", ".page-footer", "enabled")).to eq(false)
    end

    it "returns 422 for an unknown template" do
      patch "/api/themes/#{theme.id}/blend", params: { template_id: "nope" }
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "GET /api/themes/:id/download" do
    it "streams a zip of the assembled folder" do
      theme = Theme.create!(name: "Ganesh", slug: "ganesh", tint_hex: "#FEF5E9")
      attach_reference_images(theme)

      get "/api/themes/#{theme.id}/download"

      expect(response).to have_http_status(:ok)
      expect(response.media_type).to eq("application/zip")
      expect(response.headers["Content-Disposition"]).to include("ganesh.zip")
      expect(response.body.bytesize).to be > 0
    end
  end

  describe "GET /api/themes/:id/preview" do
    it "returns a payload entry per template with css + sample invoice html" do
      theme = Theme.create!(name: "Ganesh", slug: "ganesh", tint_hex: "#FEF5E9")
      attach_reference_images(theme)

      get "/api/themes/#{theme.id}/preview"

      expect(response).to have_http_status(:ok)
      templates = response.parsed_body["templates"]
      expect(templates.size).to eq(TemplateRegistry.ids.size)
      first = templates.first
      expect(first).to include("template_id", "canvas", "css", "image_url", "base_invoice_html")
      expect(first["base_invoice_html"]).to include("items-table-header")
    end
  end

  describe "POST /api/themes/:id/publish" do
    it "reports 501 until the publish API is configured" do
      theme = Theme.create!(name: "Ganesh")
      post "/api/themes/#{theme.id}/publish"
      expect(response).to have_http_status(:not_implemented)
      expect(response.parsed_body["error"]).to include("PUBLISH_API_URL")
    end

    context "when the publish API is configured" do
      let(:theme) { Theme.create!(name: "Ganesh", status: :ready) }

      before do
        allow(ENV).to receive(:[]).and_call_original
        allow(ENV).to receive(:[]).with("PUBLISH_API_URL").and_return("https://mock.test/publish")
      end

      it "returns the published status on success" do
        allow_any_instance_of(PublishService).to receive(:call) { theme.update!(status: :published) }
        post "/api/themes/#{theme.id}/publish"
        expect(response).to have_http_status(:ok)
        expect(response.parsed_body["status"]).to eq("published")
      end

      it "returns 502 when the upstream handoff fails" do
        allow_any_instance_of(PublishService).to receive(:call).and_raise(PublishService::Error, "boom")
        post "/api/themes/#{theme.id}/publish"
        expect(response).to have_http_status(:bad_gateway)
        expect(response.parsed_body["error"]).to eq("boom")
      end
    end
  end
end
