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

    # POST /api/themes/:id/upload-artwork
    # Use a user-supplied image as the artwork instead of generating one. Runs
    # inline (no engine call, so it is fast) and returns the ready theme.
    def upload_artwork
      ArtworkUploadService.new(@theme, params[:image]).call
      render json: theme_json(@theme)
    end

    # POST /api/themes/:id/regenerate
    def regenerate
      @theme.update!(prompt: params[:prompt]) if params[:prompt].present?
      start_generation!
      render json: { id: @theme.id, status: @theme.status }, status: :accepted
    end

    # PATCH /api/themes/:id/blend
    # Returns CSS for every template the edit touched — an opacity change is
    # canvas-wide, so it comes back with all templates of that canvas.
    def blend
      templates = BlendUpdaterService.new(@theme, params.require(:template_id), blend_attrs).call
      render json: { templates: templates }
    end

    # PATCH /api/themes/:id/select-variant
    # Pick which generated artwork variant is active. Updates the theme-level tint
    # to that variant's cached tint and returns freshly-assembled CSS for every
    # template so the frontend can re-tint all previews in one round-trip.
    def select_variant
      index = params.require(:variant).to_i
      count = @theme.variant_count
      if count.zero? || !index.between?(0, count - 1)
        return render json: { error: ["variant out of range"] }, status: :unprocessable_entity
      end

      tint = Array(@theme.variant_tints)[index] || @theme.tint_hex
      @theme.update!(selected_variant: index, tint_hex: tint)

      templates = TemplateRegistry.ids.map do |template_id|
        { template_id: template_id, css: CssAssemblerService.new(@theme, template_id).call }
      end
      render json: {
        selected_variant: @theme.selected_variant,
        tint_hex: @theme.tint_hex,
        templates: templates
      }
    end

    # GET /api/themes/:id/download[?name=my_theme]
    # `name` renames the package — the zip, its root folder, `.overlay_name`,
    # and the artwork url in every stylesheet — without touching the theme.
    def download
      packager = ThemePackagerService.new(@theme, overlay_name: params[:name])
      zip = Tempfile.new([packager.overlay_name, ".zip"], binmode: true)
      packager.zip(zip.path)
      send_data File.binread(zip.path),
                type: "application/zip",
                filename: "#{packager.overlay_name}.zip",
                disposition: "attachment"
    ensure
      zip&.close!
    end

    private

    def create_params
      params.permit(:name, :prompt)
    end

    # Permit opacity/tint/blend-mode plus the arbitrary-keyed nested `strips` hash.
    def blend_attrs
      permitted = params.permit(:artwork_opacity, :tint_hex, :blend_mode).to_h
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
