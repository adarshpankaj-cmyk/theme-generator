# frozen_string_literal: true

require "fileutils"
require "tmpdir"

# ThemePackagerService — assembles the full publishable theme folder on disk and
# zips it on demand (F3). Mirrors the reference folder shape byte-for-byte:
#
#   <overlay_name>/
#   ├── .overlay_name              # the overlay name, no trailing newline
#   ├── images/{a4,a5}.jpeg        # the two generated artwork images
#   └── css/<template>/latest.css  # all 9 templates
#
# `overlay_name` is the package's identity: the folder name, the .overlay_name
# contents, and the folder segment in each stylesheet's artwork url. It defaults
# to the theme's slug, and callers may override it to ship the same theme under
# a different name without renaming the theme itself. The image basenames stay
# a4/a5 — the reference theme's fixed convention.
#
# See backend/SPEC.md §7.
class ThemePackagerService
  # Raised when a requested overlay name has no usable characters.
  class InvalidNameError < StandardError; end

  # canvas => reader returning the selected-variant attachment.
  SELECTED_IMAGES = { "a4" => :selected_a4_image, "a5" => :selected_a5_image }.freeze

  # The resolved package name — always a slug, so it is safe as a single path
  # segment and as a download filename.
  # @return [String]
  attr_reader :overlay_name

  # @param theme [Theme]
  # @param overlay_name [String, nil] name to package under; nil uses the slug.
  # @raise [InvalidNameError] if `overlay_name` slugifies to nothing.
  def initialize(theme, overlay_name: nil)
    @theme = theme
    @overlay_name = resolve_overlay_name(overlay_name)
  end

  # Build the theme folder under `parent_dir`.
  # @param parent_dir [String]
  # @return [String] path to the built `<overlay_name>` folder.
  def build(parent_dir)
    root = File.join(parent_dir, @overlay_name)
    FileUtils.mkdir_p(root)
    write_overlay_name(root)
    write_images(root)
    write_css(root)
    root
  end

  # Build the folder in a temp dir and package it into a zip.
  # @param zip_path [String]
  # @return [String] zip_path.
  def zip(zip_path)
    Dir.mktmpdir do |tmp|
      create_zip(build(tmp), zip_path)
    end
    zip_path
  end

  private

  # Slugify the requested name so it can never escape the package directory or
  # produce an unsafe filename; fall back to the theme's own slug.
  def resolve_overlay_name(requested)
    return @theme.slug if requested.blank?

    slug = Theme.slugify(requested)
    raise InvalidNameError, "name must contain at least one letter or number" if slug.blank?

    slug
  end

  # The overlay name, deliberately with no trailing newline (matches the reference).
  def write_overlay_name(root)
    File.write(File.join(root, ".overlay_name"), @overlay_name)
  end

  # Copy the selected variant's artwork into images/<canvas>.jpeg.
  def write_images(root)
    images_dir = File.join(root, "images")
    FileUtils.mkdir_p(images_dir)
    SELECTED_IMAGES.each do |canvas, reader|
      attachment = @theme.public_send(reader)
      next if attachment.nil?

      File.binwrite(File.join(images_dir, "#{canvas}.jpeg"), attachment.blob.download)
    end
  end

  # Render all 9 css/<template>/latest.css files.
  def write_css(root)
    TemplateRegistry.ids.each do |template_id|
      dir = File.join(root, "css", template_id)
      FileUtils.mkdir_p(dir)
      css = CssAssemblerService.new(@theme, template_id, overlay_name: @overlay_name).call
      File.write(File.join(dir, "latest.css"), css)
    end
  end

  # Zip the folder at `root`, preserving the `<slug>/...` prefix inside the zip.
  def create_zip(root, zip_path)
    FileUtils.rm_f(zip_path)
    parent = File.dirname(root)
    Zip::File.open(zip_path, Zip::File::CREATE) do |zipfile|
      Dir.glob(File.join(root, "**", "*"), File::FNM_DOTMATCH).each do |path|
        next if File.directory?(path)

        zipfile.add(path.sub("#{parent}/", ""), path)
      end
    end
  end
end
