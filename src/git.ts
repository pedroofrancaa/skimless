import { execFileSync } from "node:child_process";

export interface DiffTarget {
  base?: string;
  staged?: boolean;
  refs?: readonly string[];
}

export function diffFromGit(target: DiffTarget, cwd: string): string {
  if (target.staged) return gitDiff(["diff", "--cached"], cwd);
  if (target.base) return gitDiff(["diff", `${assertRef(target.base)}...HEAD`], cwd);
  const refs = (target.refs ?? []).slice(0, 2).map(assertRef);
  if (refs.length > 0) return gitDiff(["diff", ...refs], cwd);
  return gitDiff(["diff", "HEAD"], cwd);
}

export function assertRef(value: string): string {
  if (value === "" || value.startsWith("-") || /[\s\0]/.test(value)) {
    throw new Error(`"${value}" is not a git ref.`);
  }
  return value;
}

export function gitDiff(args: readonly string[], cwd: string): string {
  const safe = args[0] === "diff" ? ["diff", "--no-ext-diff", "--no-textconv", "--no-color", ...args.slice(1)] : [...args];
  try {
    return execFileSync("git", safe, {
      cwd,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const failure = error as NodeJS.ErrnoException & { stderr?: string | Buffer };
    if (failure.code === "ENOENT") throw new Error("git is not installed, or it is not on PATH.");
    const stderr = Buffer.isBuffer(failure.stderr) ? failure.stderr.toString("utf8") : (failure.stderr ?? "");
    const detail = stderr.trim();
    throw new Error(detail || "git diff failed.");
  }
}
