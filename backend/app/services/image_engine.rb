# frozen_string_literal: true

# ImageEngine — pluggable image-generation providers (F2). Swap providers via
# config without touching the generation pipeline. See SPEC.md §6.2.
module ImageEngine
  class Error < StandardError; end
end
