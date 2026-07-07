import type { JSX } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Download04Icon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import { themesApi } from '@/api/themes';

interface DownloadButtonProps {
  readonly themeId: number;
  /** Theme slug — used as the downloaded zip's filename. */
  readonly slug: string;
}

/**
 * Downloads the packaged theme folder (the assembled CSS files) as a zip via
 * `GET /themes/:id/download`. The endpoint responds with an attachment, so a
 * transient anchor click triggers the browser download without leaving the app.
 */
export function DownloadButton({ themeId, slug }: DownloadButtonProps): JSX.Element {
  const handleDownload = (): void => {
    const anchor = document.createElement('a');
    anchor.href = themesApi.downloadUrl(themeId);
    anchor.download = `${slug}.zip`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  return (
    <Button variant="outline" onClick={handleDownload}>
      <HugeiconsIcon icon={Download04Icon} />
      Download CSS
    </Button>
  );
}
