# frozen_string_literal: true

# Theme — one record carries everything needed to assemble a publishable theme
# folder: name, prompt, the two generated artwork images, and the per-template
# blend settings (tint / opacity / enabled-strips) layered over registry
# defaults. See backend/SPEC.md §4.
class Theme < ApplicationRecord
  # Lifecycle: draft → generating → ready → published; failed on error.
  STATUSES = %w[draft generating ready published failed].freeze
  enum :status, STATUSES.index_by(&:itself), default: "draft", validate: true

  # The generated artwork candidates: N portrait A4 + N landscape A5 images.
  # Variant i is the pair (a4_images[i], a5_images[i]); selected_variant picks one.
  has_many_attached :a4_images
  has_many_attached :a5_images

  validates :name, presence: true
  validates :slug, presence: true, uniqueness: true
  validates :artwork_opacity,
            numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 1 }

  before_validation :assign_slug, on: :create

  # Artwork variants in stable order (attachment id ascending == insertion order),
  # so index == variant index regardless of association default ordering.
  # @return [Array<ActiveStorage::Attachment>]
  def a4_variants
    a4_images.attachments.sort_by(&:id)
  end

  # @return [Array<ActiveStorage::Attachment>]
  def a5_variants
    a5_images.attachments.sort_by(&:id)
  end

  # The active A4 / A5 artwork attachment for the selected variant (nil until
  # generated). @return [ActiveStorage::Attachment, nil]
  def selected_a4_image
    a4_variants[selected_variant.to_i]
  end

  # @return [ActiveStorage::Attachment, nil]
  def selected_a5_image
    a5_variants[selected_variant.to_i]
  end

  # @return [Integer] how many artwork variants have been generated (A4 count).
  def variant_count
    a4_variants.size
  end

  # Effective per-template overrides ({} when none). Keyed by template id; see §4.1.
  # @param template_id [String]
  # @return [Hash]
  def overrides_for(template_id)
    (blend_overrides || {})[template_id.to_s] || {}
  end

  # @param value [String]
  # @return [String] slugified form: lowercase, non-alnum → "_", collapse
  #   repeats, strip leading/trailing "_" (see §4).
  def self.slugify(value)
    value.to_s
         .downcase
         .gsub(/[^a-z0-9]+/, "_")
         .gsub(/_+/, "_")
         .gsub(/\A_+|_+\z/, "")
  end

  private

  # Derive a unique slug from the name. On collision, append a numeric suffix.
  def assign_slug
    return if slug.present?

    base = self.class.slugify(name)
    candidate = base
    counter = 2
    while self.class.where(slug: candidate).exists?
      candidate = "#{base}_#{counter}"
      counter += 1
    end
    self.slug = candidate
  end
end
