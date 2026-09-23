import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { readFixture } from "../src/demo/fixture.ts";
import { redactPacket, reviewDiff } from "../src/review.ts";
import { renderHtml } from "../src/report/html.ts";

const patch = readFixture();

test("the sample packet leads with the API and keeps noise at the end", () => {
  const packet = reviewDiff(patch, { now: new Date("2026-09-23T12:00:00.000Z") });
  const paths = packet.files.map((file) => file.path);
  assert.equal(paths[0], "src/api/index.ts");
  assert.ok(paths.indexOf("src/webhooks/verify.ts") < paths.indexOf("docs/webhooks.md"));
  assert.ok(paths.indexOf("src/webhooks/verify.ts") < paths.indexOf("package-lock.json"));
  assert.ok(paths.indexOf("migrations/2026_09_23_api_keys.sql") < paths.indexOf("package-lock.json"));
  assert.equal(paths.at(-1), "src/generated/types.ts");
  const ruleIds = new Set(packet.findings.map((finding) => finding.ruleId));
  for (const id of ["secret-pattern", "timing-compare", "workflow-permissions", "deleted-tests", "migration", "missing-tests", "api-change", "dependency-manifest", "lockfile", "runtime-config"]) {
    assert.ok(ruleIds.has(id), id);
  }
  assert.equal(packet.files.find((file) => file.path === "docs/webhooks.md")?.findings.length, 0);
  assert.equal(packet.stats.riskLabel, "high");
  assert.equal(packet.headline, "Do not skim this one");
  const verify = packet.files.find((file) => file.path === "src/webhooks/verify.ts");
  const body = verify?.hunks.flatMap((hunk) => hunk.lines.map((line) => line.text)).join("\n") ?? "";
  assert.match(body, /timingSafeEqual\(Buffer\.from\(expected\), Buffer\.from\(expected\)\)/);
  assert.equal(packet.language, "en");
});

test("portuguese copy and ignore globs", () => {
  const packet = reviewDiff(patch, { lang: "pt", ignore: ["docs/**", "**/package-lock.json"] });
  assert.equal(packet.headline, "Não passa o olho nesse");
  assert.equal(packet.files.some((file) => file.path === "docs/webhooks.md"), false);
  assert.equal(packet.files.some((file) => file.path === "package-lock.json"), false);
  assert.equal(packet.stats.ignored, 2);
});

test("redaction strips the sample key from the shareable packet", () => {
  const packet = reviewDiff(patch);
  const raw = JSON.stringify(packet);
  assert.match(raw, /sk_live_51HhExampleKeyDoNotShip/);
  const redacted = JSON.stringify(redactPacket(packet));
  assert.equal(redacted.includes("sk_live_51HhExampleKeyDoNotShip"), false);
  assert.match(redacted, /sk_live_••••/);
  assert.equal(renderHtml(redactPacket(packet)).includes("sk_live_51HhExampleKeyDoNotShip"), false);
});

test("many medium findings do not make a packet high", () => {
  const body = Array.from({ length: 20 }, (_, index) => `+export const n${index} = ${index};`).join("\n");
  const diff = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf"].map((name) => `diff --git a/lib/${name}.js b/lib/${name}.js
--- a/lib/${name}.js
+++ b/lib/${name}.js
@@ -0,0 +1,20 @@
${body}
`).join("");
  const packet = reviewDiff(diff);
  assert.equal(packet.stats.counts.high, 0);
  assert.ok(packet.stats.counts.medium >= 7);
  assert.equal(packet.stats.riskLabel, "medium");
  assert.ok(packet.stats.riskScore < 70);
  assert.notEqual(packet.headline, "Do not skim this one");
});

test("redaction covers AI provider keys and new GitHub tokens", () => {
  const tail = "Z".repeat(40);
  const keys = [`sk-ant-api03-${tail}`, `sk-proj-${tail}`, `github_pat_${tail}`, `AIza${"B".repeat(35)}`];
  const diff = `diff --git a/src/keys.ts b/src/keys.ts
--- a/src/keys.ts
+++ b/src/keys.ts
@@ -0,0 +1,${keys.length} @@
${keys.map((key, index) => `+export const k${index} = "${key}";`).join("\n")}
`;
  const redacted = JSON.stringify(redactPacket(reviewDiff(diff)));
  for (const key of keys) assert.equal(redacted.includes(key), false, key);
  assert.match(redacted, /sk-ant-••••/);
  assert.match(redacted, /github_pat_••••/);
});

test("a docs-only change stays calm", () => {
  const quiet = reviewDiff(readFixture("quiet.patch"));
  assert.equal(quiet.stats.riskLabel, "calm");
  assert.equal(quiet.findings.length, 0);
});

test("the rule catalog is documented", () => {
  const docs = readFileSync(new URL("../docs/rules.md", import.meta.url), "utf8");
  for (const id of ["secret-pattern", "code-exec", "timing-compare", "workflow-permissions", "deleted-tests", "migration", "sensitive-surface", "missing-tests", "html-sink", "dependency-manifest", "runtime-config", "api-change", "large-file", "over-budget", "lockfile", "ci-changed", "binary-file", "whitespace-only", "generated-file"]) {
    assert.ok(docs.includes(id), id);
  }
});
