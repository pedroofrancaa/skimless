# Library

```js
import { reviewDiff, redactPacket } from "skimless";
import { readFileSync } from "node:fs";

const patch = readFileSync("pr.diff", "utf8");
const packet = redactPacket(reviewDiff(patch, {
  lang: "en",
  order: "story",
  budgetMinutes: 25,
  ignore: ["**/*.snap"],
}));

console.log(packet.headline);
console.log(packet.readingOrder.map((stop) => stop.path));
```

`packet.findings` is the flat list, highest severity first. `packet.files` is already in reading order and each file carries its own findings and hunks. `packet.clusters` regroups those paths for a sidebar.

Build with `npm run build` before importing the package entry. Day to day, `node --experimental-strip-types src/cli.ts` runs the TypeScript source directly and does not need the compile.
