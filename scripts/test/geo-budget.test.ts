// AC 9: check-geo-budget passes on the committed files and fails on a file over each cap.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO = join(import.meta.dirname, "..", "..");
const LOOKUP = "packages/regions/src/data/provinces-lookup.json";
const DISPLAY = "apps/web/public/geo/provinsi.json";
const DETAIL = "apps/web/public/geo/provinsi/papua.json";
const COAST = "apps/web/public/geo/garis-pantai.json";

function check(root?: string) {
  return spawnSync("node", [join(REPO, "scripts/check-geo-budget.mjs"), ...(root ? ["--root", root] : [])], { encoding: "utf8" });
}

/** Deterministic hex text that gzip cannot shrink much (about 2:1). */
function noise(chars: number): string {
  const parts: string[] = [];
  let seed = "r137";
  while (parts.length * 64 < chars) {
    seed = createHash("sha256").update(seed).digest("hex");
    parts.push(seed);
  }
  return parts.join("").slice(0, chars);
}

/** A copy of the committed geo files where one file is padded past its cap (still valid JSON). */
function rootWithPadded(relative: string, padding: string): string {
  const root = mkdtempSync(join(tmpdir(), "geo-budget-"));
  for (const path of [LOOKUP, "apps/web/public/geo"]) cpSync(join(REPO, path), join(root, path), { recursive: true });
  const data = JSON.parse(readFileSync(join(REPO, relative), "utf8")) as Record<string, unknown>;
  writeFileSync(join(root, relative), JSON.stringify({ ...data, padding }));
  return root;
}

describe("check-geo-budget (AC 9)", () => {
  it("passes on the committed files", () => {
    const result = check();
    expect(result.status).toBe(0);
    expect(result.stdout.trim().split("\n").at(-1)).toBe("geo-budget OK");
  });

  it.each([
    ["(a) lookup raw", LOOKUP, " ".repeat(1_600_000)],
    ["(b) provinsi.json gzip", DISPLAY, noise(400_000)],
    ["(c) provinsi/<slug>.json gzip", DETAIL, noise(160_000)],
    ["(e) garis-pantai.json gzip", COAST, noise(500_000)],
  ])("fails on a file over cap %s", (label, relative, padding) => {
    const result = check(rootWithPadded(relative, padding));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`geo-budget FAIL ${label}`);
  });
});
