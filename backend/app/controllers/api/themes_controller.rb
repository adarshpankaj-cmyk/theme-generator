# frozen_string_literal: true

module Api
  # Theme CRUD + generation + blend + download (F6). See SPEC.md §8.
  class ThemesController < BaseController
    before_action :set_theme, except: :create

    # POST /api/themes
    def create
      theme = Theme.create!(create_params)
      render json: theme_json(theme), status: :created
    end

    # GET /api/themes/:id
    def show
      render json: theme_json(@theme)
    end

    # POST /api/themes/:id/generate
    def generate
      start_generation!
      render json: { id: @theme.id, status: @theme.status }, status: :accepted
    end

    # POST /api/themes/:id/regenerate
    def regenerate
      @theme.update!(prompt: params[:prompt]) if params[:prompt].present?
      start_generation!
      render json: { id: @theme.id, status: @theme.status }, status: :accepted
    end

    # PATCH /api/themes/:id/blend
    def blend
      css = BlendUpdaterService.new(@theme, params.require(:template_id), blend_attrs).call
      render json: { template_id: params[:template_id], css: css }
    end

    # GET /api/themes/:id/download
    def download
      zip = Tempfile.new([@theme.slug, ".zip"], binmode: true)
      ThemePackagerService.new(@theme).zip(zip.path)
      send_data File.binread(zip.path),
                type: "application/zip",
                filename: "#{@theme.slug}.zip",
                disposition: "attachment"
    ensure
      zip&.close!
    end

    private

    def create_params
      params.permit(:name, :prompt)
    end

    # Permit opacity/tint plus the arbitrary-keyed nested `strips` hash.
    def blend_attrs
      permitted = params.permit(:artwork_opacity, :tint_hex).to_h
      permitted["strips"] = params[:strips].permit!.to_h if params[:strips].present?
      permitted
    end

    # Flip to `generating`, clear any prior error, and enqueue the async job (F2).
    def start_generation!
      @theme.update!(status: :generating, error_message: nil)
      GenerateThemeImagesJob.perform_later(@theme.id)
    end
  end
end
