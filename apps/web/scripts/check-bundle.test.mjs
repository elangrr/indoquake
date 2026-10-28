import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { measureHomeBundle } from "./check-bundle.mjs";

function fakeBuild(pageChunk, css = ".x{color:red}") {
  const dir = mkdtempSync(join(tmpdir(), "iq-bundle-"));
  mkdirSync(join(dir, "server/app"), { recursive: true });
  mkdirSync(join(dir, "static/chunks"), { recursive: true });
  writeFileSync(join(dir, "build-manifest.json"), JSON.stringify({ rootMainFiles: ["static/chunks/main.js"] }));
  writeFileSync(join(dir, "static/chunks/main.js"), "console.log(1)");
  writeFileSync(join(dir, "static/chunks/page.js"), pageChunk);
  writeFileSync(join(dir, "static/chunks/page.css"), css);
  writeFileSync(
    join(dir, "server/app/page_client-reference-manifest.js"),
    `globalThis.__RSC_MANIFEST = globalThis.__RSC_MANIFEST || {};\nglobalThis.__RSC_MANIFEST["/page"] = ${JSON.stringify({
      entryJSFiles: { "[project]/apps/web/src/app/page": ["static/chunks/page.js"] },
      entryCSSFiles: { "[project]/apps/web/src/app/page": [{ path: "static/chunks/page.css" }] },
    })};`,
  );
  return dir;
}

describe("measureHomeBundle", () => {
  it("passes a small home entry", () => {
    expect(measureHomeBundle(fakeBuild("export const a = 1;"))).toMatchObject({ files: 2, forbidden: [], pass: true });
  });

  it("fails when leaflet code is in the home entry", () => {
    expect(measureHomeBundle(fakeBuild('el.className="leaflet-pane"')).forbidden).toEqual([
      "leaflet in static/chunks/page.js",
    ]);
  });

  it("fails when leaflet.css is in the home entry css", () => {
    expect(measureHomeBundle(fakeBuild("1", ".leaflet-pane{z-index:400}")).pass).toBe(false);
  });
});
