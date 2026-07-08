# frozen_string_literal: true

module Api
  # Shared base for the JSON API (F6): consistent error handling and the theme
  # response presenter (SPEC.md §8).
  class BaseController < ActionController::API
    rescue_from ActiveRecord::RecordNotFound, with: :render_not_found
    rescue_from ActiveRecord::RecordInvalid, with: :render_unprocessable
    rescue_from TemplateRegistry::UnknownTemplateError, with: :render_unprocessable

    private

    def set_theme
      @theme = Theme.find(params[:id])
    end

    # The canonical theme response object (SPEC.md §8).
    def theme_json(theme)
      {
        id: theme.id,
        name: theme.name,
        slug: theme.slug,
        prompt: theme.prompt,
        status: theme.status,
        tint_hex: theme.tint_hex,
        artwork_opacity: theme.artwork_opacity&.to_f,
        selected_variant: theme.selected_variant,
        a4_image_urls: image_urls(theme.a4_variants),
        a5_image_urls: image_urls(theme.a5_variants),
        a4_image_url: attachment_url(theme.selected_a4_image),
        a5_image_url: attachment_url(theme.selected_a5_image),
        blend_overrides: theme.blend_overrides,
        error_message: theme.error_message,
        templates: TemplateRegistry.ids
      }
    end

    # @param attachment [ActiveStorage::Attachment, nil]
    def attachment_url(attachment)
      return nil if attachment.nil?

      rails_blob_url(attachment.blob)
    end

    # @param attachments [Enumerable<ActiveStorage::Attachment>]
    # @return [Array<String>] a blob URL per attachment, in the given order.
    def image_urls(attachments)
      attachments.map { |attachment| rails_blob_url(attachment.blob) }
    end

    def render_not_found(error)
      render json: { error: error.message }, status: :not_found
    end

    def render_unprocessable(error)
      messages = error.respond_to?(:record) ? error.record.errors.full_messages : [error.message]
      render json: { error: messages }, status: :unprocessable_entity
    end
  end
end
