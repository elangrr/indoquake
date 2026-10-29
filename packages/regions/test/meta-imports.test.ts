// AC 8: the client-safe entry must not reach geometry. Follows the real import graph from src/meta.ts.
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");

function importsOf(file: string): string[] {
  const source = readFileSync(file, "utf8");
  return [...source.matchAll(/(?:import|export)[^"']*?from\s*["']([^"']+)["']/g)].map((match) => match[1]);
}

function reachableFrom(entry: string): string[] {
  const seen = new Set<string>();
  const queue = [entry];
  const specifiers: string[] = [];
  while (queue.length > 0) {
    const file = queue.shift()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const specifier of importsOf(file)) {
      specifiers.push(specifier);
      if (!specifier.startsWith(".")) continue;
      const target = resolve(dirname(file), specifier);
      if (target.endsWith(".json")) continue;
      queue.push(target.endsWith(".ts") ? target : `${target}.ts`);
    }
  }
  return specifiers;
}

describe("meta entry imports (AC 8)", () => {
  const imported = reachableFrom(join(ROOT, "src/meta.ts"));

  it("never imports the lookup geometry", () => {
    expect(imported.filter((specifier) => specifier.includes("provinces-lookup"))).toEqual([]);
  });

  it("never imports @indoquake/geo or the lookup module", () => {
    expect(imported.filter((specifier) => /@indoquake\/geo|\/lookup|\/provinces$/.test(specifier))).toEqual([]);
  });

  it("is exported as ./meta next to the server entry", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { exports: Record<string, string> };
    expect(Object.keys(pkg.exports)).toEqual([".", "./meta"]);
    expect(pkg.exports["./meta"]).toBe("./src/meta.ts");
  });
});
