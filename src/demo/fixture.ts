import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function readFixture(name = "webhook-hardening.patch"): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return readFileSync(join(here, "../../examples", name), "utf8");
}
