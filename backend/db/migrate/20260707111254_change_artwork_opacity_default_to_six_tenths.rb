# frozen_string_literal: true

# Raise the default artwork opacity for new themes from 0.35 to 0.60. The image
# guardrail now designs artwork for a ~60% render, so new themes should default
# to that. Existing rows keep their stored value. Reversible.
class ChangeArtworkOpacityDefaultToSixTenths < ActiveRecord::Migration[7.2]
  def change
    change_column_default :themes, :artwork_opacity, from: 0.35, to: 0.60
  end
end
