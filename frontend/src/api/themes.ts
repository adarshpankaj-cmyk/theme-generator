import { apiUrl, request, upload } from './http';
import type {
  BlendInput,
  BlendResponse,
  CreateThemeInput,
  GenerationAck,
  PreviewResponse,
  PublishResponse,
  RegenerateInput,
  SelectVariantInput,
  SelectVariantResponse,
  Theme,
} from './types';

/**
 * Typed client for the theme API surface (backend SPEC §8). One method per
 * endpoint; every method returns a typed promise.
 */
export interface ThemesApi {
  create(input: CreateThemeInput): Promise<Theme>;
  get(id: number, signal?: AbortSignal): Promise<Theme>;
  generate(id: number): Promise<GenerationAck>;
  /**
   * Use a user-supplied image as the artwork instead of generating one. Runs
   * inline on the backend, so it resolves with the already-`ready` theme.
   */
  uploadArtwork(id: number, file: File): Promise<Theme>;
  regenerate(id: number, input?: RegenerateInput): Promise<GenerationAck>;
  preview(id: number, signal?: AbortSignal): Promise<PreviewResponse>;
  blend(id: number, input: BlendInput): Promise<BlendResponse>;
  selectVariant(id: number, input: SelectVariantInput): Promise<SelectVariantResponse>;
  publish(id: number): Promise<PublishResponse>;
  /**
   * Direct URL for the theme zip; hand to an anchor to trigger a download.
   * `name` packages the theme under that name — the zip, its root folder,
   * `.overlay_name`, and the artwork url in every stylesheet — leaving the
   * stored theme untouched. Omit it to use the theme's own slug.
   */
  downloadUrl(id: number, name?: string): string;
}

export const themesApi: ThemesApi = {
  create(input) {
    return request<Theme>('/themes', { method: 'POST', body: input });
  },

  get(id, signal) {
    return request<Theme>(`/themes/${id}`, { signal });
  },

  generate(id) {
    return request<GenerationAck>(`/themes/${id}/generate`, { method: 'POST' });
  },

  uploadArtwork(id, file) {
    const form = new FormData();
    form.append('image', file);
    return upload<Theme>(`/themes/${id}/upload-artwork`, form);
  },

  regenerate(id, input) {
    return request<GenerationAck>(`/themes/${id}/regenerate`, {
      method: 'POST',
      body: input ?? {},
    });
  },

  preview(id, signal) {
    return request<PreviewResponse>(`/themes/${id}/preview`, { signal });
  },

  blend(id, input) {
    return request<BlendResponse>(`/themes/${id}/blend`, { method: 'PATCH', body: input });
  },

  selectVariant(id, input) {
    return request<SelectVariantResponse>(`/themes/${id}/select-variant`, {
      method: 'PATCH',
      body: input,
    });
  },

  publish(id) {
    return request<PublishResponse>(`/themes/${id}/publish`, { method: 'POST' });
  },

  downloadUrl(id, name) {
    return apiUrl(`/themes/${id}/download`, name === undefined ? undefined : { name });
  },
};
