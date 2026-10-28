import { describe, expect, it } from "vitest";
import { BmkgHttpError, fetchBmkgFeed, parseRetryAfter } from "../src";

function fakeFetch(response: Response, seen: { url?: string; headers?: Record<string, string> } = {}): typeof fetch {
  return (async (url: string, init: RequestInit) => {
    seen.url = url;
    seen.headers = init.headers as Record<string, string>;
    return response;
  }) as unknown as typeof fetch;
}

describe("fetchBmkgFeed", () => {
  it("requests <base>/<feed>.json with the stored validators", async () => {
    const seen: { url?: string; headers?: Record<string, string> } = {};
    await fetchBmkgFeed("autogempa", {
      baseUrl: "http://bmkg.test/TEWS/",
      etag: '"abc"',
      lastModified: "Wed, 28 Oct 2026 10:00:00 GMT",
      fetchImpl: fakeFetch(new Response(null, { status: 304 }), seen),
    });
    expect(seen.url).toBe("http://bmkg.test/TEWS/autogempa.json");
    expect(seen.headers).toMatchObject({
      "if-none-match": '"abc"',
      "if-modified-since": "Wed, 28 Oct 2026 10:00:00 GMT",
    });
  });

  it("returns not-modified for 304 and the payload plus validators for 200", async () => {
    const notModified = await fetchBmkgFeed("autogempa", { fetchImpl: fakeFetch(new Response(null, { status: 304 })) });
    const ok = await fetchBmkgFeed("autogempa", {
      fetchImpl: fakeFetch(new Response('{"Infogempa":{}}', { status: 200, headers: { etag: '"v2"' } })),
    });
    expect([notModified, ok]).toEqual([
      { status: "not-modified" },
      { status: "ok", payload: { Infogempa: {} }, etag: '"v2"', lastModified: null },
    ]);
  });

  it("throws BmkgHttpError with the Retry-After seconds on 429", async () => {
    const response = new Response("", { status: 429, headers: { "retry-after": "90" } });
    await expect(fetchBmkgFeed("gempaterkini", { fetchImpl: fakeFetch(response) })).rejects.toEqual(
      new BmkgHttpError("gempaterkini", 429, 90),
    );
  });
});

describe("parseRetryAfter", () => {
  const NOW = Date.parse("2026-10-28T10:00:00Z");
  it.each([
    ["90", 90],
    ["900", 300],
    ["Wed, 28 Oct 2026 10:02:00 GMT", 120],
    ["soon", null],
    [null, null],
  ])("%s gives %s seconds", (value, expected) => {
    expect(parseRetryAfter(value, NOW)).toBe(expected);
  });
});
