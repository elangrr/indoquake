import { describe, expect, it, vi } from "vitest";
import { PROVINCE_TABLE } from "@indoquake/regions/meta";
import { PROVINCIAL_CAPITALS } from "@/lib/provincial-capitals";
import { GET } from "./route";

vi.mock("@/lib/redis", () => ({ getRedis: () => ({ incr: async () => 1, expire: async () => 1 }) }));

describe("provincial capitals in the location panel (AC 34)", () => {
  it("has one capital for each of the 38 provinces", () => {
    expect(Object.keys(PROVINCIAL_CAPITALS).sort()).toEqual(PROVINCE_TABLE.map((row) => row.slug).sort());
  });

  it.each(Object.entries(PROVINCIAL_CAPITALS))("%s capital is land in that province per /api/v1/area", async (slug, capital) => {
    const response = await GET(new Request(`http://localhost/api/v1/area?lat=${capital.latitude}&lon=${capital.longitude}`));
    expect((await response.json()).data).toMatchObject({ kind: "land", provinceSlug: slug });
  });
});
