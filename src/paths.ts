import type { DiffFile } from "./types.ts";

export function pathOf(file: Pick<DiffFile, "oldPath" | "newPath">): string {
  return file.newPath || file.oldPath || "(unknown)";
}

export function normalizePath(value: string): string {
  return value.replaceAll("\\", "/");
}
