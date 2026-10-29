import { describe, expect, it } from "vitest";
import { historyApiQuery, historyPageHref, parseHistoryFilters } from "./history-query";

const q = (text: string) => new URLSearchParams(text);

describe("historyApiQuery", () => {
  it.each([
    ["", "page=1&limit=50"],
    ["minMag=4&maxMag=6.5", "minMagnitude=4&maxMagnitude=6.5&page=1&limit=50"],
    ["minMag=4,5", "minMagnitude=4.5&page=1&limit=50"],
    ["minDepth=10&maxDepth=70", "minDepthKm=10&maxDepthKm=70&page=1&limit=50"],
    [
      "from=2026-10-01&to=2026-10-28",
      "from=2026-09-30T17%3A00%3A00.000Z&to=2026-10-28T16%3A59%3A59.999Z&page=1&limit=50",
    ],
    ["province=jawa-barat&felt=1&tsunami=1", "province=jawa-barat&felt=true&tsunami=true&page=1&limit=50"],
    ["q=Cilacap&page=3", "q=Cilacap&page=3&limit=50"],
    ["q=a", "page=1&limit=50"],
    ["minMag=abc&page=-2&felt=yes", "page=1&limit=50"],
    ["area=sea", "area=sea&page=1&limit=50"],
    ["area=land&province=papua", "province=papua&area=land&page=1&limit=50"],
    ["area=sea&province=papua", "province=papua&page=1&limit=50"],
    ["area=ocean", "page=1&limit=50"],
  ])("riwayat?%s requests %s", (search, api) => {
    expect(historyApiQuery(parseHistoryFilters(q(search)))).toBe(api);
  });
});

describe("historyPageHref", () => {
  it.each([
    ["q=Malang&page=2", 3, "/riwayat?q=Malang&page=3"],
    ["q=Malang&page=2", 1, "/riwayat?q=Malang"],
    ["", 1, "/riwayat"],
  ])("from ?%s page %s links to %s", (search, page, href) => {
    expect(historyPageHref(q(search), page)).toBe(href);
  });
});
