# frozen_string_literal: true

module Api
  # Publish handoff (F5). Packages the theme folder and POSTs it to myBillbook's
  # existing API, then marks the theme published.
  #
  # [NEED] The myBillbook publish API — URL, payload shape, auth (SPEC.md §10.3).
  # Until PUBLISH_API_URL is configured, this endpoint reports 501 so the surface
  # is complete and testable without fabricating the external contract. The
  # actual handoff (PublishService) is built in the F5 increment.
  class PublishController < BaseController
    before_action :set_theme

    # POST /api/themes/:id/publish
    def create
      unless ENV["PUBLISH_API_URL"].present?
        return render json: {
          error: "Publish API not configured [NEED: PUBLISH_API_URL]. Use GET /download to verify the folder in the meantime."
        }, status: :not_implemented
      end

      PublishService.new(@theme).call
      render json: { status: @theme.reload.status }
    rescue PublishService::Error => e
      render json: { error: e.message }, status: :bad_gateway
    end
  end
end
