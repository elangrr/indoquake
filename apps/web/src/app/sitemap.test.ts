import { describe, expect, it } from "vitest";
import sitemap from "./sitemap";

describe("sitemap (AC 37)", () => {
  const urls = sitemap().map((entry) => entry.url);

  it("lists the 5 nav URLs and the 38 province pages", () => {
    expect(urls).toHaveLength(43);
  });

  it.each([
    "https://indoquake.indonode.net",
    "https://indoquake.indonode.net/riwayat",
    "https://indoquake.indonode.net/statistik",
    "https://indoquake.indonode.net/provinsi",
    "https://indoquake.indonode.net/notifikasi",
    "https://indoquake.indonode.net/provinsi/aceh",
    "https://indoquake.indonode.net/provinsi/jawa-barat",
    "https://indoquake.indonode.net/provinsi/papua-barat-daya",
  ])("includes %s", (url) => {
    expect(urls).toContain(url);
  });
});
