import { apiUrl, request } from './http';
import type {
  BlendInput,
  BlendResponse,
  CreateThemeInput,
  GenerationAck,
  PreviewResponse,
  PublishResponse,
  RegenerateInput,
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
  regenerate(id: number, input?: RegenerateInput): Promise<GenerationAck>;
  preview(id: number, signal?: AbortSignal): Promise<PreviewResponse>;
  blend(id: number, input: BlendInput): Promise<BlendResponse>;
  publish(id: number): Promise<PublishResponse>;
  /** Direct URL for the theme zip; hand to an anchor to trigger a download. */
  downloadUrl(id: number): string;
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

  publish(id) {
    return request<PublishResponse>(`/themes/${id}/publish`, { method: 'POST' });
  },

  downloadUrl(id) {
    return apiUrl(`/themes/${id}/download`);
  },
};
