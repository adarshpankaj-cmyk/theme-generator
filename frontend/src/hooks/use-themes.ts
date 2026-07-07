import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { themesApi } from '@/api/themes';
import type {
  BlendInput,
  BlendResponse,
  CreateThemeInput,
  GenerationAck,
  PreviewResponse,
  PublishResponse,
  RegenerateInput,
  Theme,
} from '@/api/types';
import { ThemeStatusValue } from '@/api/types';

/** Query key factory for theme-related caches. */
export const themeKeys = {
  all: ['themes'] as const,
  detail: (id: number) => [...themeKeys.all, id] as const,
  preview: (id: number) => [...themeKeys.all, id, 'preview'] as const,
};

/** Poll interval (ms) while a theme is generating (SPEC §6). */
const GENERATION_POLL_MS = 2000;

/**
 * Fetch a theme, polling every 2s while it is `generating` and stopping once it
 * reaches `ready` / `failed` / `published`. Disabled when `id` is null.
 */
export function useTheme(id: number | null): UseQueryResult<Theme> {
  return useQuery({
    queryKey: id === null ? themeKeys.all : themeKeys.detail(id),
    queryFn: ({ signal }) => themesApi.get(id as number, signal),
    enabled: id !== null,
    refetchInterval: (query) =>
      query.state.data?.status === ThemeStatusValue.Generating ? GENERATION_POLL_MS : false,
    // Keep polling even if the tab is backgrounded — generation is a
    // fire-and-wait flow; the user may switch away while it runs.
    refetchIntervalInBackground: true,
  });
}

/**
 * Fetch the preview grid payload. Gate with `enabled` (typically the theme's
 * `ready` status) so we don't request previews before generation completes.
 */
export function useThemePreview(id: number | null, enabled: boolean): UseQueryResult<PreviewResponse> {
  return useQuery({
    queryKey: id === null ? themeKeys.all : themeKeys.preview(id),
    queryFn: ({ signal }) => themesApi.preview(id as number, signal),
    enabled: enabled && id !== null,
  });
}

/**
 * Create a theme then kick off generation (SPEC §6.1). Seeds the theme cache in
 * `generating` state so the poll starts immediately.
 */
export function useGenerateTheme(): UseMutationResult<Theme, Error, CreateThemeInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateThemeInput): Promise<Theme> => {
      const theme = await themesApi.create(input);
      await themesApi.generate(theme.id);
      return { ...theme, status: ThemeStatusValue.Generating };
    },
    onSuccess: (theme) => {
      queryClient.setQueryData(themeKeys.detail(theme.id), theme);
    },
  });
}

/** Re-run image generation for an existing theme (SPEC §6.5). */
export function useRegenerateTheme(id: number): UseMutationResult<GenerationAck, Error, RegenerateInput | void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RegenerateInput | void) =>
      themesApi.regenerate(id, input ?? undefined),
    onSuccess: (ack) => {
      queryClient.setQueryData<Theme | undefined>(themeKeys.detail(id), (prev) =>
        prev ? { ...prev, status: ack.status } : prev,
      );
    },
  });
}

/**
 * Patch blend settings for one template and return its recomputed CSS. The
 * optimistic-update wiring lives in the blend editor (Phase 4).
 */
export function useBlend(id: number): UseMutationResult<BlendResponse, Error, BlendInput> {
  return useMutation({
    mutationFn: (input: BlendInput) => themesApi.blend(id, input),
  });
}

/** Publish a theme to myBillbook (SPEC §6.6). */
export function usePublish(id: number): UseMutationResult<PublishResponse, Error, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => themesApi.publish(id),
    onSuccess: (result) => {
      queryClient.setQueryData<Theme | undefined>(themeKeys.detail(id), (prev) =>
        prev ? { ...prev, status: result.status } : prev,
      );
    },
  });
}
