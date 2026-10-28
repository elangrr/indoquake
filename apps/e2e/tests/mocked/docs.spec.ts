import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const ROOT = join(import.meta.dirname, "..", "..", "..", "..");
const read = (file: string) => readFileSync(join(ROOT, file), "utf8");
const headingLevels = (text: string) => [...text.matchAll(/^(#+) /gm)].map((match) => match[1]);
const relativeLinks = (text: string) =>
  [...text.matchAll(/\]\(([^)]+)\)/g)].map((match) => match[1]).filter((href) => !/^https?:/.test(href));

const EXPECTED_LINKS = [
  "README.id.md",
  "docs/screenshots/home-desktop-light.png",
  "docs/screenshots/home-mobile-light.png",
  "docs/screenshots/home-desktop-dark.png",
  "docs/screenshots/home-mobile-dark.png",
  "docs/screenshots/riwayat-desktop-light.png",
  "docs/screenshots/statistik-mobile-dark.png",
  "docs/design/README.md",
];

test("E14 both READMEs share one heading structure", () => {
  expect(headingLevels(read("README.md"))).toEqual(["#", "##", "##", "##", "##", "##", "##"]);
  expect(headingLevels(read("README.id.md"))).toEqual(["#", "##", "##", "##", "##", "##", "##"]);
});

test("E14 README links are the screenshots and docs that exist", () => {
  expect(relativeLinks(read("README.md"))).toEqual(EXPECTED_LINKS);
  expect(relativeLinks(read("README.id.md"))).toEqual(["README.md", ...EXPECTED_LINKS.slice(1)]);
});

for (const file of [...EXPECTED_LINKS, "README.md"]) {
  test(`E14 ${file} exists`, () => {
    expect(existsSync(join(ROOT, file))).toBe(true);
  });
}

test("E14 both READMEs carry the live URL, BMKG terms and the safety disclaimer", () => {
  for (const file of ["README.md", "README.id.md"]) {
    const text = read(file);
    expect(text, file).toContain("https://indoquake.indonode.net");
    expect(text, file).toContain("60");
    expect(text, file).toContain("https://data.bmkg.go.id/gempabumi/");
    expect(text, file).toContain(
      "Situs ini menyajikan estimasi informasi dan bukan pengganti informasi darurat resmi. Untuk peringatan resmi gempa dan tsunami, ikuti BMKG dan pihak berwenang setempat.",
    );
  }
});
