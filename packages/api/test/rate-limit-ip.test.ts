import { describe, expect, it } from "vitest";
import { clientIp, hitRateLimit, RATE_LIMITS, rateLimitResponse } from "../src";

function fakeRedis() {
  const counts = new Map<string, number>();
  return {
    incr: async (key: string) => {
      counts.set(key, (counts.get(key) ?? 0) + 1);
      return counts.get(key) as number;
    },
    expire: async () => 1 as const,
  };
}

const NOW = Date.parse("2026-10-28T12:00:30.000Z");

describe("hitRateLimit (A-18)", () => {
  it("allows 5 test sends per minute per key, then answers with the seconds left in the window", async () => {
    const redis = fakeRedis();
    const hit = () => hitRateLimit(redis, RATE_LIMITS.testPerIp, "ip-a", NOW);
    const results = [await hit(), await hit(), await hit(), await hit(), await hit(), await hit()];
    expect(results.slice(4)).toEqual([{ ok: true }, { ok: false, retryAfterSeconds: 30 }]);
    expect(await hitRateLimit(redis, RATE_LIMITS.testPerIp, "ip-b", NOW)).toEqual({ ok: true });
  });

  it("fails open when Redis is unreachable", async () => {
    const broken = { incr: async () => Promise.reject(new Error("down")), expire: async () => 1 as const };
    expect(await hitRateLimit(broken, RATE_LIMITS.subscribe, "ip-a", NOW)).toEqual({ ok: true });
  });
});

describe("clientIp (D19)", () => {
  it.each([
    [{ "x-real-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.1" }, "203.0.113.7"],
    [{ "x-forwarded-for": "198.51.100.1" }, "unknown"],
    [{}, "unknown"],
  ])("headers %o give %s", (headers, expected) => {
    expect(clientIp(new Headers(headers))).toBe(expected);
  });
});

describe("rateLimitResponse (A-18)", () => {
  it("answers the 11th subscription from one X-Real-IP within an hour with 429, whatever X-Forwarded-For says", async () => {
    const redis = fakeRedis();
    const attempt = (forwardedFor: string) => {
      const ip = clientIp(new Headers({ "x-real-ip": "203.0.113.7", "x-forwarded-for": forwardedFor }));
      return rateLimitResponse(redis, [{ rule: RATE_LIMITS.subscribe, key: ip }], NOW);
    };
    const allowed = await Promise.all(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"].map(attempt));
    const blocked = (await attempt("11")) as Response;
    expect(allowed).toEqual([null, null, null, null, null, null, null, null, null, null]);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBe("3570");
    expect(await blocked.json()).toEqual({ error: "Terlalu banyak permintaan. Coba lagi nanti.", retryAfterSeconds: 3570 });
  });

  it("stops test sends at 200 per day overall even from fresh IPs", async () => {
    const redis = fakeRedis();
    const send = (ip: string) =>
      rateLimitResponse(redis, [
        { rule: RATE_LIMITS.testPerIp, key: ip },
        { rule: RATE_LIMITS.testGlobal, key: "all" },
      ], NOW);
    await Promise.all(Array.from({ length: 200 }, (_unused, index) => send(`ip-${index}`)));
    expect((await send("ip-new"))?.status).toBe(429);
  });
});
