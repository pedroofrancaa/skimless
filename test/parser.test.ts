import assert from "node:assert/strict";
import { test } from "node:test";

import { parsePatch } from "../src/parse/patch.ts";

test("parses a modify, an add, and a delete", () => {
  const files = parsePatch(`diff --git a/src/a.ts b/src/a.ts
index 111..222 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,3 +1,3 @@
 line1
-line2
+line2 changed
 line3
diff --git a/src/new.ts b/src/new.ts
new file mode 100644
index 0000000..3333333
--- /dev/null
+++ b/src/new.ts
@@ -0,0 +1 @@
+export const ready = true;
diff --git a/src/old.ts b/src/old.ts
deleted file mode 100644
index 4444444..0000000
--- a/src/old.ts
+++ /dev/null
@@ -1 +0,0 @@
-export const gone = true;
`);
  assert.equal(files.length, 3);
  assert.equal(files[0]?.status, "modified");
  assert.equal(files[0]?.additions, 1);
  assert.equal(files[0]?.deletions, 1);
  assert.equal(files[0]?.hunks[0]?.lines[1]?.oldLine, 2);
  assert.equal(files[0]?.hunks[0]?.lines[2]?.newLine, 2);
  assert.equal(files[1]?.status, "added");
  assert.equal(files[1]?.newPath, "src/new.ts");
  assert.equal(files[1]?.oldPath, null);
  assert.equal(files[2]?.status, "deleted");
  assert.equal(files[2]?.oldPath, "src/old.ts");
});

test("parses renames and quoted paths", () => {
  const files = parsePatch(`diff --git a/src/old-name.ts b/src/new-name.ts
similarity index 90%
rename from src/old-name.ts
rename to src/new-name.ts
index 111..222 100644
--- a/src/old-name.ts
+++ b/src/new-name.ts
@@ -1 +1 @@
-export const name = "old";
+export const name = "new";
diff --git "a/my file.ts" "b/my file.ts"
--- "a/my file.ts"
+++ "b/my file.ts"
@@ -1 +1 @@
-hello
+hello!
`);
  assert.equal(files[0]?.status, "renamed");
  assert.equal(files[0]?.oldPath, "src/old-name.ts");
  assert.equal(files[0]?.newPath, "src/new-name.ts");
  assert.equal(files[0]?.similarity, 90);
  assert.equal(files[1]?.newPath, "my file.ts");
  assert.equal(files[1]?.additions, 1);
});

test("marks binary files and does not parse the git binary body", () => {
  const files = parsePatch(`diff --git a/assets/logo.png b/assets/logo.png
new file mode 100644
index 0000000..1111111
GIT binary patch
literal 12
not a real hunk
@@ -1 +1 @@
+this is still binary noise
diff --git a/src/after.ts b/src/after.ts
--- a/src/after.ts
+++ b/src/after.ts
@@ -1 +1 @@
-a
+b
`);
  assert.equal(files.length, 2);
  assert.equal(files[0]?.isBinary, true);
  assert.equal(files[0]?.hunks.length, 0);
  assert.equal(files[1]?.newPath, "src/after.ts");
  assert.equal(files[1]?.additions, 1);
});
