import { useState, type FormEvent, type JSX } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { AiMagicIcon, Loading03Icon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import type { CreateThemeInput } from '@/api/types';

interface PromptBarProps {
  /** True while a generation request is in flight. */
  readonly isGenerating: boolean;
  /** Submit handler — receives a derived name + the raw prompt. */
  readonly onGenerate: (input: CreateThemeInput) => void;
}

/** Derive a short display name from the prompt; the backend slugifies it. */
function deriveName(prompt: string): string {
  const trimmed = prompt.trim().replace(/\s+/g, ' ');
  const clipped = trimmed.slice(0, 60);
  return clipped.length > 0 ? clipped : 'Untitled theme';
}

/**
 * The single prompt input + Generate button (F7). Owns only the draft text;
 * lifecycle state lives in `App`. Rendered as one integrated pill: sparkle,
 * borderless input, and the brand CTA share a glowing container.
 */
export function PromptBar({ isGenerating, onGenerate }: PromptBarProps): JSX.Element {
  const [prompt, setPrompt] = useState('');
  const canSubmit = prompt.trim().length > 0 && !isGenerating;

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    onGenerate({ name: deriveName(prompt), prompt: prompt.trim() });
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
        placeholder="Describe a theme — e.g. Ganesh ji festival overlay, warm saffron tint"
        aria-label="Theme prompt"
        disabled={isGenerating}
        className="h-10 min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/70 disabled:opacity-50"
      />
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
