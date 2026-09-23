#!/usr/bin/env node
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { cwd } from "node:process";

import { RULES } from "./analyze/rules.ts";
import { loadConfig, loadDefaultConfig, normalizeLang } from "./config.ts";
import { readFixture } from "./demo/fixture.ts";
import { diffFromGit } from "./git.ts";
import { serveMcp } from "./mcp.ts";
import { renderHtml } from "./report/html.ts";
import { renderMarkdown, renderSummary } from "./report/markdown.ts";
import { renderTerminal } from "./report/terminal.ts";
import { redactPacket, reviewDiff } from "./review.ts";
import type { SkimlessConfig, Order, ReviewPacket, Severity } from "./types.ts";
import { version } from "./version.ts";
import { emptyHint, L } from "./copy.ts";

interface Parsed {
  command: string;
  positionals: string[];
  help: boolean;
  version: boolean;
  staged: boolean;
  redact: boolean;
  ignore: string[];
  input?: string;
  out?: string;
  format?: string;
  base?: string;
  failOn?: string;
  lang?: string;
  order?: string;
  config?: string;
  budget?: string;
  largeFile?: string;
  summary?: string;
}

const FORMATS = new Set(["text", "html", "md", "json", "all"]);
const FAIL = new Set(["none", "info", "low", "medium", "high"]);

export async function main(argv: readonly string[], io: { stdout: (value: string) => void; stderr: (value: string) => void } = {
  stdout: (value) => process.stdout.write(value),
  stderr: (value) => process.stderr.write(value),
}): Promise<number> {
  let args: Parsed;
  try {
    args = parseArgs(argv);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.stderr(`${message}\n`);
    return 2;
  }
  if (args.version) {
    io.stdout(`${version}\n`);
    return 0;
  }
  if (args.help || args.command === "help") {
    io.stdout(helpText());
    return 0;
  }
  try {
    if (args.command === "mcp") {
      await serveMcp(process.stdin, (line) => process.stdout.write(line), { cwd: cwd() });
      return 0;
    }
    if (args.command === "rules") return printRules(args, io.stdout);
    if (args.command === "demo") return renderReview(readFixture(), args, io, false);
    if (args.command === "review") {
      const patch = readPatch(args);
      const fromGitDefault = args.input === undefined && !args.staged && args.base === undefined && args.positionals.length === 0;
      return renderReview(patch, args, io, fromGitDefault);
    }
    io.stderr(`Unknown command "${args.command}".\n\n${helpText()}`);
    return 2;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.stderr(`${message}\n`);
    return 2;
  }
}

function renderReview(
  patch: string,
  args: Parsed,
  io: { stdout: (value: string) => void; stderr: (value: string) => void },
  hintIfEmpty: boolean,
): number {
  const config = resolveConfig(args);
  const format = args.format ?? "text";
  if (!FORMATS.has(format)) throw new Error(`Unknown format "${format}". Use text, html, md, json, or all.`);
  const failOn = (args.failOn ?? config.failOn ?? "none") as string;
  if (!FAIL.has(failOn)) throw new Error(`Unknown --fail-on "${failOn}".`);
  const lang = (args.lang ? normalizeLang(args.lang) : config.lang ?? "en");
  if (!lang) throw new Error('Unknown --lang. Use "en" or "pt".');
  const order = (args.order ?? config.order ?? "story") as string;
  if (order !== "story" && order !== "risk") throw new Error('Unknown --order. Use "story" or "risk".');
  const packet = reviewDiff(patch, {
    lang,
    order: order as Order,
    ignore: [...(config.ignore ?? []), ...args.ignore],
    ...(config.largeFileLines !== undefined || args.largeFile !== undefined
      ? { largeFileLines: args.largeFile !== undefined ? numberFlag(args.largeFile, "--large-file") : config.largeFileLines }
      : {}),
    ...(config.testGapLines !== undefined ? { testGapLines: config.testGapLines } : {}),
    ...(config.budgetMinutes !== undefined || args.budget !== undefined
      ? { budgetMinutes: args.budget !== undefined ? numberFlag(args.budget, "--budget") : config.budgetMinutes }
      : {}),
  });
  const visible = args.redact ? redactPacket(packet) : packet;
  if (hintIfEmpty && visible.stats.files === 0) {
    io.stdout(`${emptyHint(lang)}\n`);
    return 0;
  }
  writeOutputs(visible, format, args.out, io.stdout);
  if (args.summary) {
    const absolute = resolve(args.summary);
    mkdirSync(dirname(absolute), { recursive: true });
    appendFileSync(absolute, renderSummary(visible), "utf8");
  }
  return shouldFail(visible, failOn as "none" | Severity) ? 1 : 0;
}

function writeOutputs(packet: ReviewPacket, format: string, out: string | undefined, stdout: (value: string) => void): void {
  if (format === "all") {
    const base = out ?? "skimless";
    writeFile(base.endsWith(".html") ? base : `${base}.html`, renderHtml(packet));
    const stem = base.replace(/\.(html|md|json)$/, "");
    writeFile(`${stem}.md`, renderMarkdown(packet));
    writeFile(`${stem}.json`, `${JSON.stringify(packet, null, 2)}\n`);
    stdout(renderTerminal(packet, { color: process.stdout.isTTY && !process.env.NO_COLOR }));
    return;
  }
  const body = render(packet, format, false);
  if (out) {
    writeFile(out, format === "json" ? body : body.endsWith("\n") ? body : `${body}\n`);
    if (format !== "text") stdout(`${out}\n`);
    else stdout(body.endsWith("\n") ? body : `${body}\n`);
    return;
  }
  const colored = format === "text" ? renderTerminal(packet, { color: process.stdout.isTTY && !process.env.NO_COLOR }) : body;
  stdout(colored.endsWith("\n") ? colored : `${colored}\n`);
}

function render(packet: ReviewPacket, format: string, color: boolean): string {
  if (format === "json") return `${JSON.stringify(packet, null, 2)}\n`;
  if (format === "md") return renderMarkdown(packet);
  if (format === "html") return renderHtml(packet);
  return renderTerminal(packet, { color });
}

function writeFile(filePath: string, contents: string): void {
  const absolute = resolve(filePath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, contents.endsWith("\n") ? contents : `${contents}\n`, "utf8");
}

function readPatch(args: Parsed): string {
  if (args.input !== undefined) {
    if (args.input === "-") return readFileSync(0, "utf8");
    return readFileSync(resolve(args.input), "utf8");
  }
  return diffFromGit({ staged: args.staged, base: args.base, refs: args.positionals }, cwd());
}

function resolveConfig(args: Parsed): SkimlessConfig {
  if (args.config) return loadConfig(resolve(args.config));
  return loadDefaultConfig(cwd());
}

function shouldFail(packet: ReviewPacket, failOn: "none" | Severity): boolean {
  if (failOn === "none") return false;
  const rank: Record<Severity, number> = { info: 0, low: 1, medium: 2, high: 3 };
  return packet.findings.some((finding) => rank[finding.severity] >= rank[failOn]);
}

function numberFlag(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${name} must be a number >= 0.`);
  return parsed;
}

function printRules(args: Parsed, stdout: (value: string) => void): number {
  const lang = args.lang ? normalizeLang(args.lang) : "en";
  if (!lang) throw new Error('Unknown --lang. Use "en" or "pt".');
  const lines = RULES.map((rule) => `${rule.severity.padEnd(7, " ")} ${rule.id.padEnd(24, " ")} ${lang === "pt" ? rule.pt : rule.en}`);
  stdout(`${lines.join("\n")}\n`);
  return 0;
}

function parseArgs(argv: readonly string[]): Parsed {
  const parsed: Parsed = {
    command: "",
    positionals: [],
    help: false,
    version: false,
    staged: false,
    redact: true,
    ignore: [],
  };
  const valued = new Set(["input", "out", "format", "base", "fail-on", "lang", "order", "config", "budget", "large-file", "ignore", "summary"]);
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] ?? "";
    if (token === "--") {
      parsed.positionals.push(...argv.slice(index + 1));
      break;
    }
    if (token.startsWith("--")) {
      const body = token.slice(2);
      const equals = body.indexOf("=");
      const name = equals === -1 ? body : body.slice(0, equals);
      const inline = equals === -1 ? undefined : body.slice(equals + 1);
      if (name === "help") parsed.help = true;
      else if (name === "version") parsed.version = true;
      else if (name === "staged") parsed.staged = true;
      else if (name === "no-redact") parsed.redact = false;
      else if (name === "redact") parsed.redact = true;
      else if (valued.has(name)) {
        const value = inline ?? argv[index + 1];
        if (value === undefined || value.startsWith("--")) throw new Error(`Missing value for --${name}.`);
        if (inline === undefined) index += 1;
        assign(parsed, name, value);
      } else {
        throw new Error(`Unknown option --${name}.`);
      }
      continue;
    }
    if (token.startsWith("-") && token.length === 2) {
      const short = token[1];
      if (short === "h") parsed.help = true;
      else if (short === "i" || short === "o" || short === "f") {
        const names: Record<string, string> = { i: "input", o: "out", f: "format" };
        const value = argv[index + 1];
        if (value === undefined) throw new Error(`Missing value for -${short}.`);
        index += 1;
        assign(parsed, names[short] ?? "input", value);
      } else throw new Error(`Unknown option -${short}.`);
      continue;
    }
    if (!parsed.command) parsed.command = token;
    else parsed.positionals.push(token);
  }
  if (!parsed.command) parsed.command = "review";
  return parsed;
}

function assign(parsed: Parsed, name: string, value: string): void {
  if (name === "ignore") {
    parsed.ignore.push(value);
    return;
  }
  if (name === "fail-on") parsed.failOn = value;
  else if (name === "large-file") parsed.largeFile = value;
  else if (name === "input") parsed.input = value;
  else if (name === "out") parsed.out = value;
  else if (name === "format") parsed.format = value;
  else if (name === "base") parsed.base = value;
  else if (name === "lang") parsed.lang = value;
  else if (name === "order") parsed.order = value;
  else if (name === "config") parsed.config = value;
  else if (name === "budget") parsed.budget = value;
  else if (name === "summary") parsed.summary = value;
}

function helpText(): string {
  return `Skimless ${version} — a reading order for pull requests that got too big.

Usage
  skimless review [git-range] [options]
  skimless demo [options]
  skimless rules [options]
  skimless mcp               Serve Skimless to AI agents over MCP (stdio)

Options
  --base <ref>         Diff ref...HEAD, the way a pull request does
  --staged             Review the index only
  --input, -i <file>   Read a unified diff. Use - for stdin
  --format, -f <kind>  text, html, md, json, or all
  --out, -o <path>     Write the packet. With --format all, this is the stem
  --fail-on <level>    none, info, low, medium, or high. Default: none
  --order <mode>       story or risk. Default: story
  --lang <lang>        en or pt
  --budget <minutes>   Flag a packet that is longer than this
  --config <file>      JSON config. Default: ./skimless.config.json
  --ignore <glob>      Skip paths. Repeatable
  --large-file <n>     Changed-line threshold. Default: 400
  --summary <file>     Append a short Markdown packet, e.g. $GITHUB_STEP_SUMMARY
  --no-redact          Keep secret-shaped strings in the packet
  -h, --help
  --version

Examples
  skimless demo
  skimless demo --lang pt --format html --out skimless.html
  skimless review --base origin/main --format all --out skimless --fail-on high

${L("en", "Scores are a reading priority, not a safety proof.", "A nota é prioridade de leitura, não prova de segurança.")}
`;
}

const invoked = process.argv[1] && (process.argv[1].endsWith("/cli.ts") || process.argv[1].endsWith("/cli.js") || process.argv[1].endsWith("\\cli.ts") || process.argv[1].endsWith("\\cli.js"));
if (invoked) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
