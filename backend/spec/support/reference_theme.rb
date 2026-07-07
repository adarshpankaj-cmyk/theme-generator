# frozen_string_literal: true

# Test helper: parse the canonical reference theme (ganesh) that is the ground
# truth for the registry and the F3 golden test. Snapshot lives in
# spec/fixtures/reference_themes/ganesh (a copy of ~/Downloads/Themes/ganesh).
module ReferenceTheme
  ROOT = Rails.root.join("spec", "fixtures", "reference_themes", "ganesh").freeze

  module_function

  # Absolute path to a template's reference latest.css.
  def css_path(template_id)
    ROOT.join("css", template_id, "latest.css")
  end

  # Extract the canvas ("a4"/"a5") from the background-image url in the file.
  def canvas_for(template_id)
    css = File.read(css_path(template_id))
    css[%r{images/(a4|a5)\.jpeg}, 1] or
      raise "No canvas image path found in #{css_path(template_id)}"
  end

  # Extract the ordered selector list from the tint rule (the block that
  # immediately follows the `body::before { ... }` rule). Whitespace-tolerant so
  # it survives the reference's trailing-space inconsistencies.
  def selectors_for(template_id)
    css = File.read(css_path(template_id))
    match = css.match(/pointer-events:\s*none;\s*\n\}\s*\n(?<selectors>.+?)\{/m)
    raise "Could not locate tint rule in #{css_path(template_id)}" unless match

    match[:selectors].split(",").map(&:strip).reject(&:empty?)
  end
end
