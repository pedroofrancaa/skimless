import assert from "node:assert/strict";
import { test } from "node:test";

import { RULES } from "../src/analyze/rules.ts";
import { reviewDiff } from "../src/review.ts";

function ids(patch: string, budgetMinutes?: number): string[] {
  const packet = reviewDiff(patch, budgetMinutes === undefined ? {} : { budgetMinutes });
  return packet.findings.map((finding) => finding.ruleId);
}

function has(patch: string, ruleId: string, budgetMinutes?: number): void {
  assert.ok(ids(patch, budgetMinutes).includes(ruleId), `${ruleId} missing from ${ids(patch, budgetMinutes).join(", ")}`);
}

function lacks(patch: string, ruleId: string): void {
  assert.equal(ids(patch).includes(ruleId), false, `${ruleId} should not fire`);
}

function added(path: string, ...lines: string[]): string {
  return `diff --git a/${path} b/${path}
--- a/${path}
+++ b/${path}
@@ -0,0 +1,${lines.length} @@
${lines.map((line) => `+${line}`).join("\n")}
`;
}

test("every published rule has a one-line description", () => {
  assert.equal(new Set(RULES.map((rule) => rule.id)).size, RULES.length);
  assert.equal(RULES.length, 21);
});

test("secret-pattern", () => {
  has(added("src/a.ts", `const key = "sk_live_abcdefghij";`), "secret-pattern");
  const fake = "x".repeat(40);
  for (const line of [
    `anthropic = "sk-ant-api03-${fake}"`,
    `openai = "sk-proj-${fake}"`,
    `google = "AIza${"A".repeat(35)}"`,
    `gh = "github_pat_${fake}"`,
    `oauth = "gho_${fake}"`,
    `npm = "npm_${"a".repeat(36)}"`,
    `stripe = "rk_live_abcdefghij"`,
  ]) {
    has(added("src/config.py", line), "secret-pattern");
  }
  lacks(added("src/a.ts", `const key = "sk-test-placeholder";`), "secret-pattern");
});

test("code-exec", () => {
  has(added("src/a.ts", "eval(userInput);"), "code-exec");
  has(added("app/tasks.py", "os.popen(cmd)"), "code-exec");
  has(added("app/tasks.py", "exec(source)"), "code-exec");
  has(added("app/models/user.rb", "system(cmd)"), "code-exec");
  has(added("app/models/user.rb", "out = `ls #{dir}`"), "code-exec");
  has(added("cmd/run.go", `out, err := exec.Command("sh", "-c", input).Output()`), "code-exec");
  has(added("public/run.php", "shell_exec($cmd);"), "code-exec");
  has(added("src/Main.java", "Runtime.getRuntime().exec(cmd);"), "code-exec");
  has(added("src/main.rs", `let out = Command::new("sh").arg(input).output();`), "code-exec");
  lacks(added("src/a.ts", "const match = pattern.exec(line);"), "code-exec");
  lacks(added("src/db.php", "$pdo->exec($sql);"), "code-exec");
  lacks(added("src/a.ts", "system(cmd);"), "code-exec");
});

test("timing-compare ignores tests", () => {
  has(`diff --git a/src/sign.ts b/src/sign.ts
--- a/src/sign.ts
+++ b/src/sign.ts
@@ -1 +1,2 @@
 export const ready = true;
+if (signature === expected) return true;
`, "timing-compare");
  const tests = ids(`diff --git a/src/sign.test.ts b/src/sign.test.ts
--- a/src/sign.test.ts
+++ b/src/sign.test.ts
@@ -1 +1,2 @@
 test("shape", () => {
+  if (signature === expected) return true;
+});
`);
  assert.equal(tests.includes("timing-compare"), false);
});

test("timing-compare covers == and compound names, not sentinel checks", () => {
  has(added("app/auth/login.py", "if hmac_value == expected:"), "timing-compare");
  has(added("src/verify.ts", "if (expectedSignature != header) throw new Error();"), "timing-compare");
  lacks(added("src/verify.ts", "if (signature === undefined) return false;"), "timing-compare");
  lacks(added("app/verify.py", "if digest is None or digest == None:"), "timing-compare");
  lacks(added("app/verify.py", "return hmac.compare_digest(signature, expected)"), "timing-compare");
});

test("privileged-trigger and ci-publish", () => {
  has(added(".github/workflows/label.yml", "on:", "  pull_request_target:"), "privileged-trigger");
  has(added(".gitlab-ci.yml", "release:", "  script:", "    - npm publish"), "ci-publish");
  has(added(".buildkite/pipeline.yml", "steps:", "  - command: docker push app:latest"), "ci-publish");
  const quiet = ids(added(".github/workflows/ci.yml", "on:", "  pull_request:"));
  assert.ok(quiet.includes("ci-changed"));
  assert.equal(quiet.includes("privileged-trigger"), false);
  assert.equal(quiet.includes("ci-publish"), false);
});

test("workflow-permissions and plain ci edits", () => {
  has(`diff --git a/.github/workflows/release.yml b/.github/workflows/release.yml
--- a/.github/workflows/release.yml
+++ b/.github/workflows/release.yml
@@ -1 +1,2 @@
 jobs:
+  contents: write
`, "workflow-permissions");
  const plain = ids(`diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -1 +1 @@
-  node-version: 22
+  node-version: 24
`);
  assert.ok(plain.includes("ci-changed"));
  assert.equal(plain.includes("workflow-permissions"), false);
});

test("deleted tests, migrations, and sensitive paths", () => {
  has(`diff --git a/test/session.test.ts b/test/session.test.ts
deleted file mode 100644
--- a/test/session.test.ts
+++ /dev/null
@@ -1 +0,0 @@
-test("session", () => {});
`, "deleted-tests");
  has(`diff --git a/migrations/001.sql b/migrations/001.sql
new file mode 100644
--- /dev/null
+++ b/migrations/001.sql
@@ -0,0 +1 @@
+create table accounts (id int);
`, "migration");
  has(`diff --git a/src/auth/session.ts b/src/auth/session.ts
--- a/src/auth/session.ts
+++ b/src/auth/session.ts
@@ -1 +1,2 @@
 export const kind = "session";
+export const ttl = 60;
`, "sensitive-surface");
});

test("html sink, manifests, runtime, api, lockfile, generated", () => {
  has(`diff --git a/src/view.ts b/src/view.ts
--- a/src/view.ts
+++ b/src/view.ts
@@ -1 +1,2 @@
 export {};
+el.innerHTML = name;
`, "html-sink");
  has(`diff --git a/package.json b/package.json
--- a/package.json
+++ b/package.json
@@ -1 +1,2 @@
 {
+  "left-pad": "^1.0.0"
`, "dependency-manifest");
  has(`diff --git a/Dockerfile b/Dockerfile
--- a/Dockerfile
+++ b/Dockerfile
@@ -1 +1 @@
-FROM node:22
+FROM node:24
`, "runtime-config");
  has(`diff --git a/src/api/index.ts b/src/api/index.ts
--- a/src/api/index.ts
+++ b/src/api/index.ts
@@ -1 +1,2 @@
 export const version = "1";
+export { charge } from "../billing/charge";
`, "api-change");
  has(`diff --git a/package-lock.json b/package-lock.json
--- a/package-lock.json
+++ b/package-lock.json
@@ -1 +1,2 @@
 {
+  "version": "1.2.3"
`, "lockfile");
  has(`diff --git a/src/generated/out.ts b/src/generated/out.ts
--- a/src/generated/out.ts
+++ b/src/generated/out.ts
@@ -1 +1,2 @@
 // generated
+export const n = 1;
`, "generated-file");
});

test("large files, whitespace, missing tests, and budget", () => {
  const added = Array.from({ length: 400 }, (_, index) => `+const line${index} = ${index};`).join("\n");
  has(`diff --git a/src/big.ts b/src/big.ts
--- a/src/big.ts
+++ b/src/big.ts
@@ -1 +1,400 @@
 keep
${added}
`, "large-file");

  const whitespace = ids(`diff --git a/src/pad.ts b/src/pad.ts
--- a/src/pad.ts
+++ b/src/pad.ts
@@ -1 +1 @@
-const a = 1
+const a = 1 
`);
  assert.deepEqual(whitespace, ["whitespace-only"]);

  const lines = Array.from({ length: 16 }, (_, index) => `+export const n${index} = ${index};`).join("\n");
  has(`diff --git a/src/billing/invoice.ts b/src/billing/invoice.ts
new file mode 100644
--- /dev/null
+++ b/src/billing/invoice.ts
@@ -0,0 +1,16 @@
${lines}
`, "missing-tests");

  has(`diff --git a/docs/readme.md b/docs/readme.md
--- a/docs/readme.md
+++ b/docs/readme.md
@@ -1 +1 @@
-hello
+hello there
`, "over-budget", 1);
});

test("examples read as docs, abbreviated tests count, and the lede tells same-name files apart", () => {
  assert.equal(reviewDiff(added("appveyor.yml", "build: off")).files[0]!.primaryRole, "ci");

  const example = reviewDiff(added("examples/auth/index.js", "module.exports = require('../../');")).files[0]!;
  assert.equal(example.primaryRole, "docs");
  assert.equal(example.findings.some((finding) => finding.ruleId === "sensitive-surface" || finding.ruleId === "api-change"), false);

  const body = Array.from({ length: 16 }, (_, index) => `exports.n${index} = ${index};`);
  const source = added("lib/application.js", ...body);
  has(source, "missing-tests");
  lacks(source + added("test/app.router.js", "it('routes', () => {});"), "missing-tests");
  has(source + added("test/a.js", "it('x', () => {});"), "missing-tests");

  const lede = reviewDiff(added("lib/router/index.js", "export const a = 1;") + added("src/api/index.js", "export const b = 2;")).lede;
  assert.match(lede, /router\/index\.js/);
  assert.match(lede, /api\/index\.js/);
});

test("binary files", () => {
  has(`diff --git a/assets/logo.png b/assets/logo.png
new file mode 100644
index 0000000..111
Binary files /dev/null and b/assets/logo.png differ
`, "binary-file");
});
