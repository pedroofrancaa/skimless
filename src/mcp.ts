import { statSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import type { Readable } from "node:stream";

import { RULES } from "./analyze/rules.ts";
import { loadDefaultConfig, normalizeLang } from "./config.ts";
import { emptyHint } from "./copy.ts";
import { diffFromGit } from "./git.ts";
import { renderSummary } from "./report/markdown.ts";
import { redactPacket, reviewDiff } from "./review.ts";
import type { Order, ReviewPacket } from "./types.ts";
import { version } from "./version.ts";

export const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"] as const;

export interface McpContext {
  cwd: string;
}

type Id = string | number | null;

interface ToolResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

const INSTRUCTIONS = [
  "Skimless orders a diff for review. It runs locally, does not call a model, and redacts secret-shaped strings before they reach you.",
  "Call review_diff before you review, summarize, or approve a change set, and read the files in the order it returns.",
  "Findings are reading priorities, not verdicts. A quiet packet does not mean the diff is safe.",
].join(" ");

const TOOLS = [
  {
    name: "review_diff",
    title: "Reading order for a diff",
    description:
      "Build a Skimless review packet: which files to read first, which can wait, and the rule behind every flag. Pass a unified diff, or omit it to run git diff in the repository. Secret-shaped strings are always redacted. No network, no model.",
    inputSchema: {
      type: "object",
      properties: {
        diff: { type: "string", description: "A unified diff. If omitted, Skimless runs git diff in the repository." },
        base: { type: "string", description: "Compare base...HEAD, the way a pull request does. Example: origin/main." },
        staged: { type: "boolean", description: "Review only staged changes." },
        cwd: { type: "string", description: "Repository directory. Defaults to the directory the server started in." },
        lang: { type: "string", enum: ["en", "pt"], description: "Packet language. Default: en, or skimless.config.json." },
        order: { type: "string", enum: ["story", "risk"], description: "story (default) or risk." },
        budgetMinutes: { type: "number", minimum: 0, description: "Flag a packet that takes longer than this to read." },
        ignore: { type: "array", items: { type: "string" }, description: "Glob patterns to skip." },
        format: { type: "string", enum: ["summary", "json"], description: "summary (Markdown, default) or json (full packet without diff lines)." },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "list_rules",
    title: "Skimless rules",
    description: "List every Skimless rule with its severity and one-line meaning.",
    inputSchema: {
      type: "object",
      properties: { lang: { type: "string", enum: ["en", "pt"] } },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
];

export function serveMcp(input: Readable, write: (line: string) => void, context: McpContext): Promise<void> {
  const lines = createInterface({ input, crlfDelay: Infinity });
  lines.on("line", (line) => {
    if (line.trim() === "") return;
    let message: unknown;
    try {
      message = JSON.parse(line) as unknown;
    } catch {
      write(`${JSON.stringify(failure(null, -32700, "Parse error"))}\n`);
      return;
    }
    const response = handleMessage(message, context);
    if (response) write(`${JSON.stringify(response)}\n`);
  });
  return new Promise((done) => lines.on("close", () => done()));
}

export function handleMessage(message: unknown, context: McpContext): object | null {
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return failure(null, -32600, "Invalid request");
  }
  const request = message as { id?: Id; method?: unknown; params?: unknown };
  const isNotification = !("id" in request);
  if (typeof request.method !== "string") return isNotification ? null : failure(request.id ?? null, -32600, "Invalid request");
  if (isNotification) return null;
  const id = request.id ?? null;
  const params = (request.params && typeof request.params === "object" ? request.params : {}) as Record<string, unknown>;

  switch (request.method) {
    case "initialize":
      return success(id, {
        protocolVersion: negotiate(params.protocolVersion),
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "skimless", title: "Skimless", version },
        instructions: INSTRUCTIONS,
      });
    case "ping":
      return success(id, {});
    case "tools/list":
      return success(id, { tools: TOOLS });
    case "tools/call":
      return callTool(id, params, context);
    default:
      return failure(id, -32601, `Method not found: ${request.method}`);
  }
}

function callTool(id: Id, params: Record<string, unknown>, context: McpContext): object {
  const args = (params.arguments && typeof params.arguments === "object" && !Array.isArray(params.arguments) ? params.arguments : {}) as Record<string, unknown>;
  if (params.name !== "review_diff" && params.name !== "list_rules") {
    return failure(id, -32602, `Unknown tool: ${String(params.name)}`);
  }
  try {
    return success(id, params.name === "review_diff" ? reviewTool(args, context) : rulesTool(args));
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    return success(id, { content: [{ type: "text", text }], isError: true } satisfies ToolResult);
  }
}

function reviewTool(args: Record<string, unknown>, context: McpContext): ToolResult {
  const cwd = args.cwd === undefined ? context.cwd : directory(args.cwd);
  const config = loadDefaultConfig(cwd);
  const lang = args.lang === undefined ? config.lang ?? "en" : normalizeLang(args.lang);
  if (!lang) throw new Error('lang must be "en" or "pt".');
  const order = args.order === undefined ? config.order ?? "story" : args.order;
  if (order !== "story" && order !== "risk") throw new Error('order must be "story" or "risk".');
  const format = args.format ?? "summary";
  if (format !== "summary" && format !== "json") throw new Error('format must be "summary" or "json".');
  const ignore = args.ignore === undefined ? [] : args.ignore;
  if (!Array.isArray(ignore) || ignore.some((item) => typeof item !== "string")) throw new Error("ignore must be an array of strings.");
  const budget = args.budgetMinutes ?? config.budgetMinutes;
  if (budget !== undefined && (typeof budget !== "number" || !Number.isFinite(budget) || budget < 0)) {
    throw new Error("budgetMinutes must be a number >= 0.");
  }

  let patch: string;
  if (args.diff !== undefined) {
    if (typeof args.diff !== "string") throw new Error("diff must be a string.");
    patch = args.diff;
  } else {
    if (args.base !== undefined && typeof args.base !== "string") throw new Error("base must be a string.");
    patch = diffFromGit({ base: args.base as string | undefined, staged: args.staged === true }, cwd);
  }

  const packet = redactPacket(reviewDiff(patch, {
    lang,
    order: order as Order,
    ignore: [...(config.ignore ?? []), ...(ignore as string[])],
    ...(budget !== undefined ? { budgetMinutes: budget as number } : {}),
    ...(config.largeFileLines !== undefined ? { largeFileLines: config.largeFileLines } : {}),
    ...(config.testGapLines !== undefined ? { testGapLines: config.testGapLines } : {}),
  }));
  if (packet.stats.files === 0) return text(emptyHint(lang));
  return text(format === "json" ? JSON.stringify(withoutLines(packet), null, 2) : renderSummary(packet));
}

function rulesTool(args: Record<string, unknown>): ToolResult {
  const lang = args.lang === undefined ? "en" : normalizeLang(args.lang);
  if (!lang) throw new Error('lang must be "en" or "pt".');
  return text(RULES.map((rule) => `- \`${rule.id}\` (${rule.severity}): ${lang === "pt" ? rule.pt : rule.en}`).join("\n"));
}

function withoutLines(packet: ReviewPacket): object {
  return { ...packet, files: packet.files.map(({ hunks: _hunks, ...file }) => file) };
}

function directory(value: unknown): string {
  if (typeof value !== "string" || value === "") throw new Error("cwd must be a directory path.");
  const absolute = resolve(value);
  let isDirectory = false;
  try {
    isDirectory = statSync(absolute).isDirectory();
  } catch {
    isDirectory = false;
  }
  if (!isDirectory) throw new Error(`cwd is not a directory: ${absolute}`);
  return absolute;
}

function negotiate(requested: unknown): string {
  return typeof requested === "string" && (PROTOCOL_VERSIONS as readonly string[]).includes(requested) ? requested : PROTOCOL_VERSIONS[0];
}

function text(value: string): ToolResult {
  return { content: [{ type: "text", text: value }] };
}

function success(id: Id, result: object): object {
  return { jsonrpc: "2.0", id, result };
}

function failure(id: Id, code: number, message: string): object {
  return { jsonrpc: "2.0", id, error: { code, message } };
}
