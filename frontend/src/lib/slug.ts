/**
 * Slugification mirroring `Theme.slugify` in the backend (backend/SPEC.md §4):
 * lowercase, every run of non-alphanumerics collapsed to a single underscore,
 * then leading/trailing underscores stripped.
 *
 * Kept in sync so the download dialog can show the exact package name the
 * server will produce. The backend re-slugifies whatever it receives, so this
 * is a preview — never the only line of defence.
 */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
