// AC 11, D21: the province generator on the committed offline fixture.
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO = join(import.meta.dirname, "..", "..");
const FIXTURE = join(import.meta.dirname, "fixtures", "geo");
const ADM1 = "geoBoundaries-IDN-ADM1_simplified.geojson";
const ADM2 = "geoBoundaries-IDN-ADM2_simplified.geojson";

interface Feature {
  properties: { shapeName?: string; shapeISO?: string };
  geometry: { type: string; coordinates: number[][][] | number[][][][] } | null;
}
interface Collection {
  features: Feature[];
}

function run(input: string, out: string) {
  return spawnSync("node", [join(REPO, "scripts/build-provinces.mjs"), "--input", input, "--out", out, "--quiet"], {
    encoding: "utf8",
  });
}

function filesUnder(dir: string): Record<string, string> {
  return Object.fromEntries(
    readdirSync(dir, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => {
        const path = join(entry.parentPath, entry.name);
        return [path.slice(dir.length), readFileSync(path, "utf8")];
      }),
  );
}

/** A copy of the fixture with one change applied to the parsed ADM1 / ADM2 collections. */
function mutatedFixture(change: (adm1: Collection, adm2: Collection) => void): string {
  const dir = mkdtempSync(join(tmpdir(), "geo-fixture-"));
  cpSync(FIXTURE, dir, { recursive: true });
  const adm1 = JSON.parse(readFileSync(join(dir, ADM1), "utf8")) as Collection;
  const adm2 = JSON.parse(readFileSync(join(dir, ADM2), "utf8")) as Collection;
  change(adm1, adm2);
  writeFileSync(join(dir, ADM1), JSON.stringify(adm1));
  writeFileSync(join(dir, ADM2), JSON.stringify(adm2));
  return dir;
}

const named = (collection: Collection, name: string) => collection.features.find((f) => f.properties.shapeName === name)!;
const iso = (collection: Collection, code: string) => collection.features.find((f) => f.properties.shapeISO === code)!;

describe("build-provinces on the offline fixture (AC 11)", () => {
  it("writes byte-identical outputs on two runs", () => {
    const first = mkdtempSync(join(tmpdir(), "geo-out-"));
    const second = mkdtempSync(join(tmpdir(), "geo-out-"));
    expect([run(FIXTURE, first).status, run(FIXTURE, second).status]).toEqual([0, 0]);
    const files = filesUnder(first);
    expect(Object.keys(files)).toHaveLength(41);
    expect(filesUnder(second)).toEqual(files);
  });

  it.each([
    [
      "a province missing from ADM1 (count 37)",
      (adm1: Collection) => {
        adm1.features = adm1.features.filter((f) => f.properties.shapeISO !== "ID-AC");
      },
      "provinsi aceh (ID-AC) tidak ada di ADM1: jumlah provinsi akan 37, harus 38",
    ],
    [
      "a regency matching no ADM2 feature",
      (_adm1: Collection, adm2: Collection) => {
        named(adm2, "Asmat").properties.shapeName = "Asmat Raya";
      },
      'kabupaten/kota "Asmat" (papua-selatan) cocok dengan 0 fitur ADM2, harus 1',
    ],
    [
      "a regency matching two ADM2 features",
      (_adm1: Collection, adm2: Collection) => {
        adm2.features.push(structuredClone(named(adm2, "Asmat")));
      },
      'kabupaten/kota "Asmat" (papua-selatan) cocok dengan 2 fitur ADM2, harus 1',
    ],
    [
      "a province without a ring",
      (adm1: Collection) => {
        iso(adm1, "ID-BA").geometry = null;
      },
      "provinsi bali tidak punya ring",
    ],
    [
      "two Papua provinces overlapping",
      (_adm1: Collection, adm2: Collection) => {
        named(adm2, "Nabire").geometry = structuredClone(named(adm2, "Jayawijaya").geometry);
      },
      "tumpang tindih antar provinsi Papua",
    ],
    [
      "dissolved Papua area more than 2% off ADM1",
      (adm1: Collection) => {
        const papua = iso(adm1, "ID-PA").geometry!.coordinates as number[][][][];
        papua.push([[[120, 2], [121, 2], [121, 3], [120, 3], [120, 2]]]);
      },
      "dari ADM1 Papua + Papua Barat",
    ],
    [
      "a city point outside its own province",
      (_adm1: Collection, adm2: Collection) => {
        named(adm2, "Merauke").geometry = { type: "Polygon", coordinates: [[[139, -9], [139.1, -9], [139.1, -8.9], [139, -8.9], [139, -9]]] };
      },
      "titik kota papua-selatan (-8.4932, 140.4018) ada di [], harus hanya papua-selatan",
    ],
  ])("fails non-zero on %s", (_name, change, message) => {
    const result = run(mutatedFixture(change), mkdtempSync(join(tmpdir(), "geo-out-")));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(message);
  });
});
