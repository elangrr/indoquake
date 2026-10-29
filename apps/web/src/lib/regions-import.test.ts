import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = fileURLToPath(new URL("..", import.meta.url));
const BARE_IMPORT = /(?:from\s*|import\s*\(\s*|import\s+)["']@indoquake\/regions["']/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe("bare @indoquake/regions import (AC 29, D35)", () => {
  it("is only used by server route handlers under src/app/api", () => {
    const offenders = sourceFiles(SRC)
      .map((file) => relative(SRC, file).split(sep).join("/"))
      .filter((file) => !file.startsWith("app/api/"))
      .filter((file) => BARE_IMPORT.test(readFileSync(join(SRC, file), "utf8")));
    expect(offenders).toEqual([]);
  });
});
