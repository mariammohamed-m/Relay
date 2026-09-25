// Tag normalization shared by `task new --tag`, `task tag add/remove`, and
// `task list --tag`: lowercase kebab-case, deduplicated, sorted.
export function normalizeTag(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeTags(raw: string[]): string[] {
  const set = new Set(raw.map(normalizeTag).filter(Boolean));
  return [...set].sort();
}
