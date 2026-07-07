import { useState, type FormEvent, type JSX } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { AiMagicIcon, Loading03Icon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
 * lifecycle state lives in `App`.
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
    <form onSubmit={handleSubmit} className="flex items-center gap-3">
      <Input
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="Describe a theme — e.g. Ganesh ji festival overlay, warm saffron tint"
        aria-label="Theme prompt"
        disabled={isGenerating}
        className="h-11 flex-1 text-base"
      />
      <Button type="submit" size="lg" disabled={!canSubmit} className="h-11 px-5">
        <HugeiconsIcon
          icon={isGenerating ? Loading03Icon : AiMagicIcon}
          className={isGenerating ? 'animate-spin' : undefined}
        />
        {isGenerating ? 'Generating…' : 'Generate'}
      </Button>
    </form>
  );
}
