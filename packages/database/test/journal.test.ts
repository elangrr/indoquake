import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MIGRATIONS_FOLDER } from "../src/migrate";

describe("migration journal (A-19)", () => {
  it("lists 0000, 0001, 0002 and 0003 in order", () => {
    const journal = JSON.parse(readFileSync(`${MIGRATIONS_FOLDER}/meta/_journal.json`, "utf8")) as {
      entries: { tag: string }[];
    };
    expect(journal.entries.map((entry) => entry.tag)).toEqual([
      "0000_shiny_amazoness",
      "0001_foamy_psynapse",
      "0002_magenta_rawhide_kid",
      "0003_conscious_deadpool",
    ]);
  });
});
