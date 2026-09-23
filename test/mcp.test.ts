import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { readFixture } from "../src/demo/fixture.ts";
import { handleMessage } from "../src/mcp.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const context = { cwd: root };

function call(name: string, args: Record<string, unknown>): { text: string; isError: boolean } {
  const response = handleMessage({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }, context) as {
    result: { content: { text: string }[]; isError?: boolean };
  };
  return { text: response.result.content.map((item) => item.text).join("\n"), isError: response.result.isError === true };
}

test("initialize negotiates the protocol and lists tools", () => {
  const init = handleMessage({ jsonrpc: "2.0", id: 0, method: "initialize", params: { protocolVersion: "2025-06-18" } }, context) as {
    result: { protocolVersion: string; serverInfo: { name: string }; capabilities: { tools: object } };
  };
  assert.equal(init.result.protocolVersion, "2025-06-18");
  assert.equal(init.result.serverInfo.name, "skimless");
  const unknown = handleMessage({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "1999-01-01" } }, context) as {
    result: { protocolVersion: string };
  };
  assert.equal(unknown.result.protocolVersion, "2025-11-25");

  assert.equal(handleMessage({ jsonrpc: "2.0", method: "notifications/initialized" }, context), null);
  const list = handleMessage({ jsonrpc: "2.0", id: 2, method: "tools/list" }, context) as { result: { tools: { name: string }[] } };
  assert.deepEqual(list.result.tools.map((tool) => tool.name), ["review_diff", "list_rules"]);
  const missing = handleMessage({ jsonrpc: "2.0", id: 3, method: "resources/list" }, context) as { error: { code: number } };
  assert.equal(missing.error.code, -32601);
});

test("review_diff returns the reading order and never leaks the sample key", () => {
  const summary = call("review_diff", { diff: readFixture() });
  assert.equal(summary.isError, false);
  assert.match(summary.text, /## Reading order/);
  assert.match(summary.text, /1\. `src\/api\/index\.ts`/);
  assert.equal(summary.text.includes("sk_live_51HhExampleKeyDoNotShip"), false);

  const json = JSON.parse(call("review_diff", { diff: readFixture(), format: "json", lang: "pt" }).text) as {
    headline: string;
    files: Record<string, unknown>[];
  };
  assert.equal(json.headline, "Não passa o olho nesse");
  assert.equal("hunks" in (json.files[0] ?? {}), false);
});

test("review_diff rejects option-shaped refs and bad input as tool errors", () => {
  const injected = call("review_diff", { base: "--output=/tmp/skimless-pwned" });
  assert.equal(injected.isError, true);
  assert.match(injected.text, /not a git ref/);
  assert.equal(call("review_diff", { order: "random", diff: "" }).isError, true);
  assert.equal(call("review_diff", { cwd: join(root, "does-not-exist") }).isError, true);
  assert.match(call("list_rules", { lang: "pt" }).text, /`secret-pattern` \(high\)/);
});

test("skimless mcp speaks JSON-RPC over stdio", () => {
  const messages = [
    { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } } },
    { jsonrpc: "2.0", method: "notifications/initialized" },
    { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "review_diff", arguments: { diff: readFixture() } } },
  ];
  const result = spawnSync(process.execPath, ["--experimental-strip-types", "src/cli.ts", "mcp"], {
    cwd: root,
    input: `${messages.map((message) => JSON.stringify(message)).join("\n")}\nnot json\n`,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  const replies = result.stdout.trim().split("\n").map((line) => JSON.parse(line) as { id: number | null; result?: unknown; error?: { code: number } });
  assert.deepEqual(replies.map((reply) => reply.id), [1, 2, null]);
  assert.equal(replies[2]?.error?.code, -32700);
  assert.match(JSON.stringify(replies[1]?.result), /Reading order/);
});

test("server.json matches package.json", () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { name: string; version: string; mcpName: string };
  const server = JSON.parse(readFileSync(join(root, "server.json"), "utf8")) as {
    name: string;
    version: string;
    description: string;
    packages: { identifier: string; version: string }[];
  };
  assert.equal(server.name, pkg.mcpName);
  assert.equal(server.version, pkg.version);
  assert.equal(server.packages[0]?.identifier, pkg.name);
  assert.equal(server.packages[0]?.version, pkg.version);
  assert.ok(server.description.length <= 100);
});

test("a directory outside git is a tool error, not a crash", () => {
  const empty = mkdtempSync(join(tmpdir(), "skimless-mcp-"));
  const result = call("review_diff", { cwd: empty });
  assert.equal(result.isError, true);
});
