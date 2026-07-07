# frozen_string_literal: true

require "vips"

# TintSamplerService — derives a near-white tint of the artwork's own hue for the
# theme-level `tint_hex` default (F2, SPEC.md §5). A warm-orange artwork should
# land near #FEF5E9 / #FFF5DA: same hue, low saturation, ~95% lightness.
class TintSamplerService
  MAX_SATURATION = 0.20
  TARGET_LIGHTNESS = 0.95
  SAMPLE_SIZE = 64 # downscale before averaging — cheap and stable.

  # @param image_bytes [String] raw image bytes (e.g. the A4 jpeg).
  def initialize(image_bytes)
    @image_bytes = image_bytes
  end

  # @return [String] uppercase hex, e.g. "#FEF5E9".
  def call
    r, g, b = average_rgb
    h, s, _l = rgb_to_hsl(r, g, b)
    hsl_to_hex(h, [s, MAX_SATURATION].min, TARGET_LIGHTNESS)
  end

  private

  # Average color of a downscaled copy, per RGB band (ignores any alpha).
  # copy_memory materializes the thumbnail so the sequential JPEG loader isn't
  # re-read out of order across the three per-band averages.
  def average_rgb
    image = Vips::Image.thumbnail_buffer(@image_bytes, SAMPLE_SIZE)
    image = image.colourspace(:srgb) unless image.bands >= 3
    image = image.copy_memory
    (0..2).map { |band| image[band].avg }
  end

  # r,g,b in 0..255 → [hue(0..360), sat(0..1), light(0..1)].
  def rgb_to_hsl(r, g, b)
    r /= 255.0
    g /= 255.0
    b /= 255.0
    max = [r, g, b].max
    min = [r, g, b].min
    delta = max - min
    l = (max + min) / 2.0

    return [0.0, 0.0, l] if delta.zero?

    s = l > 0.5 ? delta / (2.0 - max - min) : delta / (max + min)
    h =
      case max
      when r then ((g - b) / delta) % 6
      when g then ((b - r) / delta) + 2
      else ((r - g) / delta) + 4
      end
    [h * 60.0, s, l]
  end

  # hue(0..360), sat(0..1), light(0..1) → "#RRGGBB" uppercase.
  def hsl_to_hex(h, s, l)
    c = (1 - (2 * l - 1).abs) * s
    x = c * (1 - ((h / 60.0) % 2 - 1).abs)
    m = l - c / 2.0
    r, g, b =
      case h
      when 0...60 then [c, x, 0]
      when 60...120 then [x, c, 0]
      when 120...180 then [0, c, x]
      when 180...240 then [0, x, c]
      when 240...300 then [x, 0, c]
      else [c, 0, x]
      end
    format("#%02X%02X%02X",
           ((r + m) * 255).round,
           ((g + m) * 255).round,
           ((b + m) * 255).round)
  end
end
