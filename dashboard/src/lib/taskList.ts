import type { CompiledTask } from "@/lib/types";

/** Every tag present across all tasks, deduplicated and sorted - the tasks sheet's filter chip set. */
export function allTags(tasks: CompiledTask[]): string[] {
  return [...new Set(tasks.flatMap((t) => t.tags))].sort();
}

/**
 * Tasks sorted newest-created-first, optionally filtered to those having
 * ANY of `selectedTags`. Filtering never changes the sort order - it only
 * removes rows - so this always sorts first, then filters.
 */
export function sortedFilteredTasks(
  tasks: CompiledTask[],
  selectedTags: string[],
): CompiledTask[] {
  const sorted = [...tasks].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  if (selectedTags.length === 0) return sorted;
  const wanted = new Set(selectedTags);
  return sorted.filter((t) => t.tags.some((tag) => wanted.has(tag)));
}
