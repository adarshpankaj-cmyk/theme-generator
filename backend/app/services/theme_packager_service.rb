# frozen_string_literal: true

require "fileutils"
require "tmpdir"

# ThemePackagerService — assembles the full publishable theme folder on disk and
# zips it on demand (F3). Mirrors the reference folder shape byte-for-byte:
#
#   <slug>/
#   ├── .overlay_name              # the slug, no trailing newline
#   ├── images/{a4,a5}.jpeg        # the two generated artwork images
#   └── css/<template>/latest.css  # all 9 templates
#
# See backend/SPEC.md §7.
class ThemePackagerService
  # canvas => ActiveStorage attachment name.
  IMAGE_ATTACHMENTS = { "a4" => :a4_image, "a5" => :a5_image }.freeze

  def initialize(theme)
    @theme = theme
  end

  # Build the theme folder under `parent_dir`.
  # @param parent_dir [String]
  # @return [String] path to the built `<slug>` folder.
  def build(parent_dir)
    root = File.join(parent_dir, @theme.slug)
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

  # The slug, deliberately with no trailing newline (matches the reference).
  def write_overlay_name(root)
    File.write(File.join(root, ".overlay_name"), @theme.slug)
  end

  # Copy each attached artwork image into images/<canvas>.jpeg.
  def write_images(root)
    images_dir = File.join(root, "images")
    FileUtils.mkdir_p(images_dir)
    IMAGE_ATTACHMENTS.each do |canvas, attachment_name|
      attachment = @theme.public_send(attachment_name)
      next unless attachment.attached?

      File.binwrite(File.join(images_dir, "#{canvas}.jpeg"), attachment.download)
    end
  end

  # Render all 9 css/<template>/latest.css files.
  def write_css(root)
    TemplateRegistry.ids.each do |template_id|
      dir = File.join(root, "css", template_id)
      FileUtils.mkdir_p(dir)
      css = CssAssemblerService.new(@theme, template_id).call
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
