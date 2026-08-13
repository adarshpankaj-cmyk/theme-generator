import { useState, type FormEvent, type JSX } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Download04Icon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { themesApi } from '@/api/themes';
import { slugify } from '@/lib/slug';

interface DownloadButtonProps {
  readonly themeId: number;
  /** Theme slug — the default package name, pre-filled in the dialog. */
  readonly slug: string;
}

/** Trigger a browser download without navigating away from the app. */
function triggerDownload(href: string, filename: string): void {
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

/**
 * Downloads the packaged theme folder (the assembled CSS files) as a zip via
 * `GET /themes/:id/download`, asking first for the name to package it under.
 *
 * That one name is the package's whole identity — the zip, its root folder,
 * `.overlay_name`, and the `flash-themes/<name>/…` artwork url inside every
 * stylesheet — so the dialog previews the exact result before committing. It
 * is a download-time choice only: the stored theme keeps its own slug.
 */
export function DownloadButton({ themeId, slug }: DownloadButtonProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(slug);

  // The server re-slugifies whatever it receives; mirroring it here means the
  // preview below is exactly what lands on disk.
  const packageName = slugify(name);
  const canDownload = packageName.length > 0;

  const handleOpenChange = (open: boolean): void => {
    // Reopening always starts from the theme's own name rather than the last edit.
    if (open) {
      setName(slug);
    }
    setIsOpen(open);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!canDownload) {
      return;
    }
    triggerDownload(themesApi.downloadUrl(themeId, packageName), `${packageName}.zip`);
    setIsOpen(false);
  };

  return (
    <>
      <Button variant="outline" onClick={() => handleOpenChange(true)}>
        <HugeiconsIcon icon={Download04Icon} />
        Download CSS
      </Button>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Name this theme package</DialogTitle>
            <DialogDescription>
              Used for the zip, the folder inside it, and the artwork path in every stylesheet.
              Your saved theme keeps its own name.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <Label htmlFor="package-name">Package name</Label>
              <Input
                id="package-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={slug}
                autoFocus
                autoComplete="off"
                spellCheck={false}
                aria-invalid={!canDownload}
                aria-describedby="package-name-preview"
              />
              <div id="package-name-preview" className="flex flex-col gap-1 text-xs">
                {canDownload ? (
                  <>
                    <p className="text-muted-foreground">
                      Downloads as <span className="font-mono text-foreground">{packageName}.zip</span>
                    </p>
                    <p className="text-muted-foreground">
                      Artwork path{' '}
                      <span className="font-mono text-foreground">
                        ./flash-themes/{packageName}/images/a4.jpeg
                      </span>
                    </p>
                  </>
                ) : (
                  <p className="text-destructive">
                    Enter at least one letter or number.
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!canDownload}>
                <HugeiconsIcon icon={Download04Icon} />
                Download
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
