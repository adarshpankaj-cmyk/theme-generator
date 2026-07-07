import type { JSX } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon } from '@hugeicons/core-free-icons';
import { Label } from '@/components/ui/label';

interface ColorFieldProps {
  readonly label: string;
  /** Current hex value, or empty string when using the inherited default. */
  readonly value: string;
  readonly disabled?: boolean;
  readonly onChange: (hex: string) => void;
  /** Reset to the inherited default (clears the override). */
  readonly onClear?: () => void;
}

/** A labelled color swatch + hex readout, with an optional clear-to-default. */
export function ColorField({
  label,
  value,
  disabled = false,
  onChange,
  onClear,
}: ColorFieldProps): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || '#ffffff'}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          aria-label={label}
          className="size-8 cursor-pointer rounded-md border border-border bg-transparent disabled:cursor-not-allowed disabled:opacity-50"
        />
        <span className="w-16 font-mono text-xs text-muted-foreground">
          {value ? value.toUpperCase() : 'default'}
        </span>
        {onClear && value ? (
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            aria-label={`Reset ${label}`}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
