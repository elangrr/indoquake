import { describe, expect, it } from "vitest";
import { bucketLabel } from "./chart-options";

describe("bucketLabel", () => {
  it.each([
    ["2 \u2013 3", "2 sampai 3"],
    ["\u2265 6", "6 ke atas"],
    ["< 2", "di bawah 2"],
    ["150 \u2013 300", "150 sampai 300"],
  ])("%s reads %s", (label, text) => {
    expect(bucketLabel(label)).toBe(text);
  });
});
