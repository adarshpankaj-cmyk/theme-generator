import { useRef, useState, type ChangeEvent, type FormEvent, type JSX } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { AiMagicIcon, Loading03Icon, Upload03Icon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import type { CreateThemeInput, UploadArtworkInput } from '@/api/types';

/** Image types the backend's upload endpoint accepts. */
const ACCEPTED_IMAGE_TYPES = 'image/png,image/jpeg,image/webp';

interface PromptBarProps {
  /** True while a generation request is in flight. */
  readonly isGenerating: boolean;
  /** True while an artwork upload is in flight. */
  readonly isUploading: boolean;
  /** Submit handler — receives a derived name + the raw prompt. */
  readonly onGenerate: (input: CreateThemeInput) => void;
  /** Upload handler — receives a derived name + the chosen artwork file. */
  readonly onUpload: (input: UploadArtworkInput) => void;
}

/** Derive a short display name from the prompt; the backend slugifies it. */
function deriveName(prompt: string): string {
  const trimmed = prompt.trim().replace(/\s+/g, ' ');
  const clipped = trimmed.slice(0, 60);
  return clipped.length > 0 ? clipped : 'Untitled theme';
}

/**
 * Name an uploaded theme after whatever the user typed, falling back to the
 * file's own stem so the theme is still recognisable when the box is empty.
 */
function deriveUploadName(prompt: string, fileName: string): string {
  if (prompt.trim().length > 0) {
    return deriveName(prompt);
  }
  const stem = fileName.replace(/\.[^./\\]+$/, '').trim();
  return stem.length > 0 ? stem.slice(0, 60) : 'Uploaded artwork';
}

/**
 * The prompt input plus the two ways to start a theme (F7): describe it and let
 * the model draw the artwork, or upload your own image. Owns only the draft text
 * and the hidden file input; lifecycle state lives in `App`. Rendered as one
 * integrated pill: sparkle, borderless input, upload affordance, brand CTA.
 */
export function PromptBar({
  isGenerating,
  isUploading,
  onGenerate,
  onUpload,
}: PromptBarProps): JSX.Element {
  const [prompt, setPrompt] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const isBusy = isGenerating || isUploading;
  const canSubmit = prompt.trim().length > 0 && !isBusy;

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    onGenerate({ name: deriveName(prompt), prompt: prompt.trim() });
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    // Clear the input so re-picking the same file fires `change` again.
    event.target.value = '';
    if (file) {
      onUpload({ name: deriveUploadName(prompt, file.name), file });
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 rounded-2xl border border-border bg-card/80 p-2 pl-4 shadow-lg shadow-black/25 backdrop-blur transition-all duration-300 focus-within:border-ring/60 focus-within:shadow-brand/15 focus-within:ring-2 focus-within:ring-ring/25"
    >
      <HugeiconsIcon
        icon={AiMagicIcon}
        className="size-5 shrink-0 text-brand-bright"
        aria-hidden="true"
      />
      <input
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="Describe a theme — or upload your own artwork"
        aria-label="Theme prompt"
        disabled={isBusy}
        className="h-10 min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/70 disabled:opacity-50"
      />
      <input
        ref={fileInput}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        onChange={handleFileChange}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
      />
      <Button
        type="button"
        size="lg"
        variant="ghost"
        disabled={isBusy}
        onClick={() => fileInput.current?.click()}
        title="Use your own image as the artwork"
        className="h-10 rounded-xl px-4 text-muted-foreground transition-colors hover:text-foreground"
      >
        <HugeiconsIcon
          icon={isUploading ? Loading03Icon : Upload03Icon}
          className={isUploading ? 'animate-spin' : undefined}
        />
        {isUploading ? 'Uploading…' : 'Upload artwork'}
      </Button>
      <Button
        type="submit"
        size="lg"
        disabled={!canSubmit}
        className="h-10 rounded-xl px-5 shadow-md shadow-brand/35 transition-all hover:shadow-lg hover:shadow-brand/45"
      >
        <HugeiconsIcon
          icon={isGenerating ? Loading03Icon : AiMagicIcon}
          className={isGenerating ? 'animate-spin' : undefined}
        />
        {isGenerating ? 'Generating…' : 'Generate'}
      </Button>
    </form>
  );
}
