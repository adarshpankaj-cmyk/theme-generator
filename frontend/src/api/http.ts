/**
 * Thin fetch wrapper around the Rails backend (SPEC §1). Owns the base URL,
 * JSON encoding, and structured error handling so callers deal in typed data.
 */

const BASE_URL: string = import.meta.env.VITE_API_BASE_URL;

if (!BASE_URL) {
  // Fail loudly at startup rather than emitting requests to `undefined/...`.
  throw new Error('VITE_API_BASE_URL is not set. Copy .env.example to .env.');
}

/** Error thrown for any non-2xx response, carrying the parsed body when present. */
export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

type QueryValue = string | number | boolean;

interface RequestOptions {
  readonly method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  readonly body?: unknown;
  readonly signal?: AbortSignal;
}

/** Build an absolute API URL from a path (leading slash optional). */
export function apiUrl(path: string, query?: Record<string, QueryValue | undefined>): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${BASE_URL}${normalized}`, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

/** Extract a human-readable message from a backend error body. */
function messageFromBody(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'error' in body) {
    const { error } = body as { error: unknown };
    if (Array.isArray(error)) {
      return error.join(', ');
    }
    if (typeof error === 'string') {
      return error;
    }
  }
  return fallback;
}

/**
 * Perform a JSON request and parse the response as `T`.
 * @throws {ApiError} on any non-2xx status.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = options;

  const response = await fetch(apiUrl(path), {
    method,
    signal,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  const parsed: unknown = text.length > 0 ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      messageFromBody(parsed, `${method} ${path} failed (${response.status})`),
      parsed,
    );
  }

  return parsed as T;
}
