import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = fileURLToPath(new URL("..", import.meta.url));

function run(args: string[]): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, ["--experimental-strip-types", "src/cli.ts", ...args], {
    cwd: root,
    encoding: "utf8",
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

test("demo json redacts by default and fails closed on high", () => {
  const ok = run(["demo", "--format", "json"]);
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(ok.stdout.includes("sk_live_51HhExampleKeyDoNotShip"), false);
  assert.match(ok.stdout, /"headline": "Do not skim this one"/);

  const open = run(["demo", "--format", "json", "--no-redact"]);
  assert.match(open.stdout, /sk_live_51HhExampleKeyDoNotShip/);

  const failed = run(["demo", "--fail-on", "high", "--format", "text"]);
  assert.equal(failed.status, 1);
  assert.match(failed.stdout, /Reading order/);
});

test("rules, help, version, and html output", () => {
  const rules = run(["rules", "--lang", "pt"]);
  assert.equal(rules.status, 0);
  assert.match(rules.stdout, /secret-pattern/);
  assert.match(rules.stdout, /credencial/);

  const version = run(["--version"]);
  assert.equal(version.stdout.trim(), "0.1.0");

  const help = run(["--help"]);
  assert.match(help.stdout, /skimless review/);

  const directory = mkdtempSync(join(tmpdir(), "skimless-"));
  const out = join(directory, "packet.html");
  const html = run(["demo", "--lang", "pt", "--format", "html", "--out", out]);
  assert.equal(html.status, 0, html.stderr);
  assert.equal(html.stdout.trim(), out);
});

test("--summary appends a short packet and keeps the exit code", () => {
  const directory = mkdtempSync(join(tmpdir(), "skimless-"));
  const summary = join(directory, "summary.md");
  writeFileSync(summary, "previous step\n");
  const result = run(["demo", "--fail-on", "high", "--summary", summary]);
  assert.equal(result.status, 1);
  const body = readFileSync(summary, "utf8");
  assert.ok(body.startsWith("previous step\n# Do not skim this one"));
  assert.match(body, /## Reading order/);
  assert.equal(body.includes("## Files"), false);
  assert.equal(body.includes("sk_live_51HhExampleKeyDoNotShip"), false);
});
