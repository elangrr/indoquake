import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const getStatistics = vi.hoisted(() => vi.fn(async () => ({ total: 0 })));

vi.mock("@/lib/db", () => ({ getDb: () => ({}) }));
vi.mock("@indoquake/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@indoquake/api")>()),
  getStatistics,
}));

async function call(query: string) {
  const response = await GET(new Request(`http://localhost/api/v1/statistics${query}`));
  return { status: response.status, body: await response.json() };
}

describe("GET /api/v1/statistics area filters (AC 18, D36)", () => {
  beforeEach(() => getStatistics.mockClear());

  it("passes area=sea to getStatistics", async () => {
    const { status } = await call("?area=sea");
    expect(status).toBe(200);
    expect(getStatistics).toHaveBeenCalledWith({}, expect.objectContaining({ area: "sea", provinceSlug: undefined }));
  });

  it("passes province and area=land to getStatistics", async () => {
    await call("?province=bali&area=land");
    expect(getStatistics).toHaveBeenCalledWith({}, expect.objectContaining({ area: "land", provinceSlug: "bali" }));
  });

  it("calls getStatistics without province or area when there are no params", async () => {
    await call("");
    expect(getStatistics).toHaveBeenCalledWith({}, { period: "30d", fromUtc: expect.any(String), provinceSlug: undefined, area: undefined });
  });

  it.each([
    ["?area=x", "Parameter tidak valid: area"],
    ["?province=bogus", "Provinsi tidak dikenal"],
    ["?province=bali&area=sea", "Parameter tidak valid: area"],
  ])("answers 400 for %s and does not query", async (query, error) => {
    expect(await call(query)).toEqual({ status: 400, body: { error } });
    expect(getStatistics).not.toHaveBeenCalled();
  });
});
