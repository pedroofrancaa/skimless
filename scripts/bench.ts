import { reviewDiff } from "../src/review.ts";

const files = 2000;
const chunks: string[] = [];
for (let index = 0; index < files; index += 1) {
  chunks.push(`diff --git a/src/file-${index}.ts b/src/file-${index}.ts
--- a/src/file-${index}.ts
+++ b/src/file-${index}.ts
@@ -1 +1,2 @@
 export const ready = true;
+export const n${index} = ${index};
`);
}

const patch = chunks.join("");
const started = performance.now();
const packet = reviewDiff(patch);
const elapsed = performance.now() - started;
console.log(`${packet.stats.files} files in ${elapsed.toFixed(0)} ms`);
if (packet.stats.files !== files) {
  console.error("unexpected file count");
  process.exitCode = 1;
}
