import type { JSX } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { AlertCircleIcon, Loading03Icon, ReloadIcon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import type { ThemeStatus } from '@/api/types';

interface StatusBannerProps {
  readonly status: ThemeStatus;
  readonly errorMessage?: string | null;
  /** Retry a failed generation. */
  readonly onRetry: () => void;
  /** True while a retry request is in flight. */
  readonly isRetrying: boolean;
}

/**
 * Full-width status surface shown while a theme is `generating` (spinner) or
 * `failed` (error + Retry). Renders nothing for terminal-ready states — the
 * caller decides when to mount it (SPEC §2, §3).
 */
export function StatusBanner({
  status,
  errorMessage,
  onRetry,
  isRetrying,
}: StatusBannerProps): JSX.Element | null {
  if (status === 'generating') {
    return (
      <div className="flex animate-in flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl border border-border/80 bg-card/60 px-6 py-16 text-card-foreground duration-500 fade-in">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-brand/15 ring-1 ring-brand/30">
          <HugeiconsIcon icon={Loading03Icon} className="size-7 animate-spin text-brand-bright" />
        </div>
        <div className="text-center">
          <p className="font-display text-base font-medium">Painting your theme…</p>
          <p className="mt-1 animate-pulse text-sm text-muted-foreground">
            Generating artwork variants and assembling every invoice format
          </p>
        </div>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="flex animate-in flex-col items-center justify-center gap-4 rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-16 duration-500 fade-in">
        <HugeiconsIcon icon={AlertCircleIcon} className="size-8 text-destructive" />
        <div className="text-center">
          <p className="font-medium text-foreground">Generation failed</p>
          {errorMessage ? (
            <p className="mt-1 max-w-md text-sm text-muted-foreground">{errorMessage}</p>
          ) : null}
        </div>
        <Button variant="outline" onClick={onRetry} disabled={isRetrying}>
          <HugeiconsIcon icon={ReloadIcon} className={isRetrying ? 'animate-spin' : undefined} />
          {isRetrying ? 'Retrying…' : 'Retry'}
        </Button>
      </div>
    );
  }

  return null;
}
