import assert from "node:assert/strict";
import { test } from "node:test";

import { globToRegExp, matchAny } from "../src/glob.ts";

test("globs match nested paths and single segments", () => {
  assert.equal(globToRegExp("docs/**").test("docs/webhooks.md"), true);
  assert.equal(globToRegExp("docs/**").test("src/docs-note.ts"), false);
  assert.equal(globToRegExp("**/*.snap").test("a/b/c.snap"), true);
  assert.equal(globToRegExp("**/*.snap").test("c.snap"), true);
  assert.equal(globToRegExp("**/*.snap").test("c.snapshot"), false);
  assert.equal(matchAny("dist/index.js", ["**/dist/**", "**/*.snap"]), true);
});
