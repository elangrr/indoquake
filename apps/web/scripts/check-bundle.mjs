// Home route First Load JS budget (B-08). Next 16 no longer prints sizes, so this reads
// the build manifests: root main files plus the entry chunks of app/layout and app/page.
// Usage: node scripts/check-bundle.mjs [.next dir]   exit 1 above the fail limit or when
// leaflet / echarts / leaflet.css are in the home entry.
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

export const BUDGET_KB = 180;
export const FAIL_KB = 200;

const FORBIDDEN = [
  { name: "leaflet", pattern: /leaflet-pane|L\.Map\b|Leaflet \d/ },
  { name: "echarts", pattern: /zrender|echarts\/lib|ECharts/ },
];
const FORBIDDEN_CSS = { name: "leaflet.css", pattern: /\.leaflet-pane/ };

function readManifest(nextDir) {
  const source = readFileSync(join(nextDir, "server/app/page_client-reference-manifest.js"), "utf8");
  const body = source.slice(source.indexOf("= {") + 2).replace(/;\s*$/, "");
  return JSON.parse(body);
}

export function measureHomeBundle(nextDir) {
  const build = JSON.parse(readFileSync(join(nextDir, "build-manifest.json"), "utf8"));
  const manifest = readManifest(nextDir);
  const entries = Object.entries(manifest.entryJSFiles ?? {});
  const pick = (suffix) => entries.filter(([key]) => key.endsWith(suffix)).flatMap(([, files]) => files);
  const js = [...new Set([...build.rootMainFiles, ...pick("/app/layout"), ...pick("/app/page")])];
  const cssEntries = Object.entries(manifest.entryCSSFiles ?? {})
    .filter(([key]) => key.endsWith("/app/layout") || key.endsWith("/app/page"))
    .flatMap(([, files]) => files.map((file) => (typeof file === "string" ? file : file.path)));
  const css = [...new Set(cssEntries)];

  let gzipBytes = 0;
  const forbidden = [];
  for (const file of js) {
    const content = readFileSync(join(nextDir, file));
    gzipBytes += gzipSync(content).length;
    for (const rule of FORBIDDEN) if (rule.pattern.test(content.toString("utf8"))) forbidden.push(`${rule.name} in ${file}`);
  }
  for (const file of css) {
    const content = readFileSync(join(nextDir, file), "utf8");
    if (FORBIDDEN_CSS.pattern.test(content)) forbidden.push(`${FORBIDDEN_CSS.name} in ${file}`);
  }
  const kb = Math.round((gzipBytes / 1024) * 10) / 10;
  return { files: js.length, gzipKb: kb, forbidden, pass: kb <= FAIL_KB && forbidden.length === 0, withinBudget: kb <= BUDGET_KB };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const nextDir = resolve(process.argv[2] ?? join(fileURLToPath(new URL(".", import.meta.url)), "..", ".next"));
  if (!existsSync(join(nextDir, "build-manifest.json"))) {
    console.error(`no build at ${nextDir}: run next build first`);
    process.exit(2);
  }
  const result = measureHomeBundle(nextDir);
  console.log(
    `home First Load JS: ${result.gzipKb} kB gzip in ${result.files} files (budget ${BUDGET_KB} kB, fail above ${FAIL_KB} kB)`,
  );
  for (const item of result.forbidden) console.log(`forbidden in home entry: ${item}`);
  console.log(result.pass ? (result.withinBudget ? "BUNDLE PASS" : "BUNDLE WARN over budget") : "BUNDLE FAIL");
  process.exit(result.pass ? 0 : 1);
}
