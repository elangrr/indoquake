import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const failingWhere = vi.hoisted(() =>
  vi.fn(() =>
    Promise.reject(
      new Error('Failed query: select count(*) from "alert_subscriptions" where "active" = $1 -- connect ECONNREFUSED 127.0.0.1:5432'),
    ),
  ),
);

vi.mock("@/lib/redis", () => ({ getRedis: () => ({ incr: async () => 1, expire: async () => 1 }) }));
vi.mock("@/lib/db", () => ({
  getDb: () => ({
    select: () => ({ from: () => ({ where: failingWhere }) }),
  }),
}));

describe("POST /api/v1/subscriptions with a failing database (A-18)", () => {
  it("answers 500 with the generic message and leaks no driver, SQL or stack text", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/v1/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json", "x-real-ip": "203.0.113.5" },
        body: JSON.stringify({ channel: "telegram", target: "123456789" }),
      }),
    );
    const text = await response.text();

    expect(failingWhere).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(500);
    expect(JSON.parse(text)).toEqual({ error: "Gagal menyimpan langganan" });
    expect(text).not.toMatch(/ECONNREFUSED|alert_subscriptions|select|at \//i);
  });
});
