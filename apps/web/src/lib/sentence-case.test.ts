import { describe, expect, it } from "vitest";
import { sentenceCase } from "./sentence-case";

describe("sentenceCase", () => {
  it.each([
    ["TIDAK BERPOTENSI TSUNAMI", "Tidak berpotensi tsunami"],
    ["BERPOTENSI TSUNAMI", "Berpotensi tsunami"],
    ["TIDAK ADA INFORMASI", "Tidak ada informasi"],
    ["", ""],
  ])("%j becomes %j", (input, expected) => {
    expect(sentenceCase(input)).toBe(expected);
  });
});
