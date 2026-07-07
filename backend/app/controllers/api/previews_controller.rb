# frozen_string_literal: true

module Api
  # Preview payload for the frontend grid (F4/F6): each template's overlay CSS +
  # its canvas image + sample base invoice HTML. See SPEC.md §8.
  #
  # NOTE: previews are routed as `GET /api/themes/:id/preview` and handled here.
  class PreviewsController < BaseController
    before_action :set_theme

    # GET /api/themes/:id/preview
    def preview
      templates = TemplateRegistry.all.map do |template|
        {
          template_id: template.id,
          canvas: template.canvas,
          css: CssAssemblerService.new(@theme, template.id).call,
          image_url: image_url(image_for(template.canvas)),
          base_invoice_html: InvoicePreview.html(template.id, template.canvas)
        }
      end

      render json: { templates: templates }
    end

    private

    def image_for(canvas)
      canvas == "a5" ? @theme.a5_image : @theme.a4_image
    end
  end
end
