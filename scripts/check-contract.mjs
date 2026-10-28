// Verifies the shared contract files are byte-identical to the orchestrator copy (DECISIONS D10, D14).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const sums = readFileSync(`${root}scripts/contract.sha256`, "utf8")
  .split("\n")
  .filter((line) => line.trim() !== "")
  .map((line) => line.trim().split(/\s+/));

let failed = false;
for (const [expected, name] of sums) {
  const actual = createHash("sha256")
    .update(readFileSync(`${root}packages/shared/src/${name}`))
    .digest("hex");
  const ok = actual === expected;
  if (!ok) failed = true;
  console.log(`${name}: ${ok ? "OK" : `FAILED (${actual})`}`);
}
process.exit(failed ? 1 : 0);
