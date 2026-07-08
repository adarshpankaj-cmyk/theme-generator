# frozen_string_literal: true

# Multi-variant artwork: a theme now holds N candidate A4/A5 image pairs. Track
# which pair is active and cache each variant's sampled tint so switching the
# selection doesn't require re-sampling. See SPEC.md §5/§6.
class AddVariantSupportToThemes < ActiveRecord::Migration[7.2]
  def change
    add_column :themes, :selected_variant, :integer, null: false, default: 0
    add_column :themes, :variant_tints, :jsonb, null: false, default: []
  end
end
