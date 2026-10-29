import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/redis", () => ({ getRedis: () => ({ incr: async () => 1, expire: async () => 1 }) }));

async function call(query: string) {
  const response = await GET(new Request(`http://localhost/api/v1/area${query}`, { headers: { "x-real-ip": "203.0.113.7" } }));
  return { status: response.status, body: await response.json() };
}

describe("GET /api/v1/area (AC 25)", () => {
  it("describes Jayapura as land in Papua, zone WIT", async () => {
    const { status, body } = await call("?lat=-2.5337&lon=140.7181");
    expect(status).toBe(200);
    expect(body.data).toMatchObject({ kind: "land", provinceSlug: "papua", provinceName: "Papua", zone: "WIT" });
  });

  it("describes Kupang as land in Nusa Tenggara Timur, zone WITA", async () => {
    const { body } = await call("?lat=-10.1772&lon=123.6070");
    expect(body.data).toMatchObject({ kind: "land", provinceSlug: "nusa-tenggara-timur", zone: "WITA" });
  });

  it("describes the Indian Ocean south of Java as sea with a nearest province", async () => {
    const { body } = await call("?lat=-9.5&lon=110");
    expect(body.data).toMatchObject({ kind: "sea", provinceSlug: null, zone: "WIB" });
    expect(["jawa-tengah", "di-yogyakarta", "jawa-timur"]).toContain(body.data.nearestProvinceSlug);
  });

  it.each([
    ["", "Parameter tidak valid: lat"],
    ["?lon=110", "Parameter tidak valid: lat"],
    ["?lat=abc&lon=110", "Parameter tidak valid: lat"],
    ["?lat=91&lon=110", "Parameter tidak valid: lat"],
    ["?lat=-7", "Parameter tidak valid: lon"],
    ["?lat=-7&lon=181", "Parameter tidak valid: lon"],
    ["?lat=-7&lon=", "Parameter tidak valid: lon"],
  ])("answers 400 for %s", async (query, error) => {
    expect(await call(query)).toEqual({ status: 400, body: { error } });
  });
});
