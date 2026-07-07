# frozen_string_literal: true

# SampleInvoice — placeholder base invoice HTML for the preview endpoint.
#
# [NEED] The real base invoice HTML/CSS per format lives in the internal
# myBillbook repo (SPEC.md §10.1). Until it's provided, we render a minimal
# invoice skeleton that includes the strip classes the overlay CSS tints, so the
# preview grid shows a realistic-enough result. Swap this out when the real
# markup arrives — nothing else in the pipeline depends on it.
module SampleInvoice
  module_function

  # @param canvas [String] "a4" or "a5"
  # @return [String] sample invoice HTML for the given canvas.
  def html(canvas)
    <<~HTML
      <div class="invoice invoice-#{canvas}">
        <header id="invoice-details-meta" class="title-bill-ship-to">
          <h1>Sample Invoice</h1>
          <p>Bill To: Acme Traders &nbsp; | &nbsp; Invoice #INV-001</p>
        </header>

        <table class="items-table">
          <thead>
            <tr class="items-table-header">
              <th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Widget A</td><td>2</td><td>500</td><td>1,000</td></tr>
            <tr><td>Widget B</td><td>1</td><td>750</td><td>750</td></tr>
          </tbody>
        </table>

        <table class="tax-table">
          <tr class="tax-table-header"><th>Tax</th><th>Rate</th><th>Amount</th></tr>
          <tr><td>GST</td><td>18%</td><td>315</td></tr>
        </table>

        <div class="items-table-total">Total: 2,065</div>
        <div class="items-table-total-foreign">USD ~24.8</div>

        <footer class="page-footer">Thank you for your business.</footer>
      </div>
    HTML
  end
end
