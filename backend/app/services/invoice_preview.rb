# frozen_string_literal: true

# InvoicePreview — supplies the base invoice HTML for the preview grid (F4/F8).
#
# For templates where a real, post-JS rendered invoice body has been captured
# (app/services/invoice_previews/bodies/<template>.html), this returns that
# populated invoice with its real CSS inlined, so previews look like the actual
# myBillbook invoice. For templates without a captured body yet, it falls back
# to the minimal SampleInvoice stub.
#
# The returned HTML is body-level: a Google-Fonts link, the invoice's own CSS in
# <style> blocks, then the invoice markup. The frontend wraps it in the html/head
# shell and layers the theme overlay CSS on top (SPEC §4).
module InvoicePreview
  BASE_DIR = Rails.root.join("app", "services", "invoice_previews").freeze
  BODIES_DIR = BASE_DIR.join("bodies").freeze
  CSS_DIR = BASE_DIR.join("css").freeze

  # Templates whose totals/box CSS also needs the A5 shared stylesheet.
  A5_TEMPLATES = %w[theme_four theme_six].freeze

  module_function

  # @param template_id [String] e.g. "theme_seven"
  # @param canvas [String] "a4" or "a5"
  # @return [String] body-level invoice HTML (styled), or the stub fallback.
  def html(template_id, canvas)
    body = read_body(template_id)
    return SampleInvoice.html(canvas) if body.nil?

    [fonts_link, style(shared_css(template_id)), style(theme_css(template_id)), body].join("\n")
  end

  # @return [Boolean] whether a captured rendered invoice exists for this template.
  def rendered?(template_id)
    body_path(template_id).file?
  end

  def read_body(template_id)
    path = body_path(template_id)
    path.file? ? path.read : nil
  end

  def body_path(template_id)
    BODIES_DIR.join("#{template_id}.html")
  end

  def shared_css(template_id)
    css = read_css("invoice_box_common.css")
    css += "\n#{read_css('invoice_a5_common.css')}" if A5_TEMPLATES.include?(template_id)
    css
  end

  def theme_css(template_id)
    read_css("#{template_id}.css")
  end

  def read_css(filename)
    path = CSS_DIR.join(filename)
    path.file? ? path.read : ""
  end

  def style(css)
    "<style>#{css}</style>"
  end

  def fonts_link
    '<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&' \
      'family=Playfair:wght@400;500;600;700&family=Mulish:wght@300;400;500;600;700&display=swap" rel="stylesheet">'
  end
end
