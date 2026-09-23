import type { DiffFile, DiffLine, FileStatus, Hunk } from "../types.ts";

interface Draft {
  oldPath: string | null;
  newPath: string | null;
  renamed: boolean;
  copied: boolean;
  added: boolean;
  removed: boolean;
  binary: boolean;
  skipBody: boolean;
  similarity: number | null;
  hunks: Hunk[];
}

const HUNK_HEADER = /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@(.*)$/;

export function parsePatch(input: string): DiffFile[] {
  const text = input.replace(/\r\n/g, "\n");
  const lines = text.split("\n");
  if (text.endsWith("\n")) lines.pop();

  const files: DiffFile[] = [];
  let current: Draft | null = null;
  let hunk: Hunk | null = null;
  let oldLine = 0;
  let newLine = 0;

  const flushHunk = (): void => {
    if (hunk && current) current.hunks.push(hunk);
    hunk = null;
  };

  const flushFile = (): void => {
    flushHunk();
    if (current) files.push(finalize(current));
    current = null;
  };

  for (const line of lines) {
    if (line.startsWith("diff --git ") || line.startsWith("diff --cc ")) {
      flushFile();
      const paths = line.startsWith("diff --git ") ? parseGitHeader(line) : { oldPath: null, newPath: null };
      current = emptyDraft(paths.oldPath, paths.newPath);
      continue;
    }

    if (!current) continue;
    if (current.skipBody) continue;

    if (line.startsWith("@@")) {
      flushHunk();
      const parsed = parseHunkHeader(line);
      if (!parsed) continue;
      hunk = parsed.hunk;
      oldLine = parsed.oldLine;
      newLine = parsed.newLine;
      continue;
    }

    if (hunk) {
      if (line.startsWith("\\")) continue;
      const consumed = consumeHunkLine(hunk, line, oldLine, newLine);
      oldLine = consumed.oldLine;
      newLine = consumed.newLine;
      continue;
    }

    if (line.startsWith("new file mode ")) current.added = true;
    else if (line.startsWith("deleted file mode ")) current.removed = true;
    else if (line.startsWith("rename from ")) {
      current.renamed = true;
      current.oldPath = line.slice("rename from ".length).trim();
    } else if (line.startsWith("rename to ")) {
      current.renamed = true;
      current.newPath = line.slice("rename to ".length).trim();
    } else if (line.startsWith("copy from ")) {
      current.copied = true;
      current.oldPath = line.slice("copy from ".length).trim();
    } else if (line.startsWith("copy to ")) {
      current.copied = true;
      current.newPath = line.slice("copy to ".length).trim();
    } else if (line.startsWith("similarity index ")) {
      const match = line.match(/(\d+)%/);
      current.similarity = match ? Number(match[1]) : null;
    } else if (line.startsWith("--- ")) {
      current.oldPath = parseDiffPath(line.slice(4));
    } else if (line.startsWith("+++ ")) {
      current.newPath = parseDiffPath(line.slice(4));
    } else if (line.startsWith("Binary files ")) {
      current.binary = true;
    } else if (line.startsWith("GIT binary patch")) {
      current.binary = true;
      current.skipBody = true;
    }
  }

  flushFile();
  return files;
}

function emptyDraft(oldPath: string | null, newPath: string | null): Draft {
  return {
    oldPath,
    newPath,
    renamed: false,
    copied: false,
    added: false,
    removed: false,
    binary: false,
    skipBody: false,
    similarity: null,
    hunks: [],
  };
}

function consumeHunkLine(
  hunk: Hunk,
  line: string,
  oldLine: number,
  newLine: number,
): { oldLine: number; newLine: number } {
  const marker = line[0] ?? " ";
  const text = line.slice(1);
  if (marker === "+") {
    hunk.lines.push(lineOf("add", text, null, newLine));
    return { oldLine, newLine: newLine + 1 };
  }
  if (marker === "-") {
    hunk.lines.push(lineOf("del", text, oldLine, null));
    return { oldLine: oldLine + 1, newLine };
  }
  hunk.lines.push(lineOf("context", marker === " " || line === "" ? text : line, oldLine, newLine));
  return { oldLine: oldLine + 1, newLine: newLine + 1 };
}

function lineOf(kind: DiffLine["kind"], text: string, oldLine: number | null, newLine: number | null): DiffLine {
  return { kind, text, oldLine, newLine };
}

function parseHunkHeader(line: string): { hunk: Hunk; oldLine: number; newLine: number } | null {
  const match = HUNK_HEADER.exec(line);
  if (!match) return null;
  const oldStart = Number(match[1]);
  const oldCount = match[2] === undefined ? 1 : Number(match[2]);
  const newStart = Number(match[3]);
  const newCount = match[4] === undefined ? 1 : Number(match[4]);
  return {
    oldLine: oldStart,
    newLine: newStart,
    hunk: {
      oldStart,
      oldCount,
      newStart,
      newCount,
      section: (match[5] ?? "").trim(),
      lines: [],
    },
  };
}

function finalize(draft: Draft): DiffFile {
  let additions = 0;
  let deletions = 0;
  for (const hunk of draft.hunks) {
    for (const line of hunk.lines) {
      if (line.kind === "add") additions += 1;
      if (line.kind === "del") deletions += 1;
    }
  }
  return {
    oldPath: draft.oldPath,
    newPath: draft.newPath,
    status: statusOf(draft),
    isBinary: draft.binary,
    hunks: draft.hunks,
    additions,
    deletions,
    similarity: draft.similarity,
  };
}

function statusOf(draft: Draft): FileStatus {
  if (draft.copied) return "copied";
  if (draft.renamed) return "renamed";
  if (draft.removed || (draft.oldPath !== null && draft.newPath === null)) return "deleted";
  if (draft.added || (draft.oldPath === null && draft.newPath !== null)) return "added";
  return "modified";
}

function parseGitHeader(line: string): { oldPath: string | null; newPath: string | null } {
  const tokens = tokenize(line.slice("diff --git ".length));
  return {
    oldPath: tokens[0] ? stripDiffPrefix(tokens[0]) : null,
    newPath: tokens[1] ? stripDiffPrefix(tokens[1]) : null,
  };
}

function tokenize(value: string): string[] {
  const tokens: string[] = [];
  let index = 0;
  while (index < value.length) {
    if (value[index] === " ") {
      index += 1;
      continue;
    }
    if (value[index] === '"') {
      let cursor = index + 1;
      let token = "";
      while (cursor < value.length) {
        if (value[cursor] === "\\" && cursor + 1 < value.length) {
          token += value[cursor + 1];
          cursor += 2;
          continue;
        }
        if (value[cursor] === '"') {
          cursor += 1;
          break;
        }
        token += value[cursor];
        cursor += 1;
      }
      tokens.push(token);
      index = cursor;
      continue;
    }
    let cursor = index;
    while (cursor < value.length && value[cursor] !== " ") cursor += 1;
    tokens.push(value.slice(index, cursor));
    index = cursor;
  }
  return tokens;
}

function parseDiffPath(raw: string): string | null {
  let value = raw.trim();
  const tab = value.indexOf("\t");
  if (tab !== -1) value = value.slice(0, tab);
  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) value = value.slice(1, -1);
  if (value === "/dev/null") return null;
  return stripDiffPrefix(value);
}

function stripDiffPrefix(value: string): string {
  if (value.startsWith("a/") || value.startsWith("b/")) return value.slice(2);
  return value;
}
