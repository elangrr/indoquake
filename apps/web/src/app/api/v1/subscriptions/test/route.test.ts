import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/redis", () => ({ getRedis: () => ({ incr: async () => 1, expire: async () => 1 }) }));
const failingSend = vi.hoisted(() =>
  vi.fn(() =>
    Promise.reject(new Error("request to https://api.telegram.org/bot0:secret/sendMessage failed, reason: connect ECONNREFUSED")),
  ),
);
vi.mock("@indoquake/notifications/senders", () => ({ sendChannelMessage: failingSend }));

describe("POST /api/v1/subscriptions/test with a failing sender (A-18)", () => {
  it("answers 502 with the generic message and leaks no sender error or stack text", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/v1/subscriptions/test", {
        method: "POST",
        headers: { "content-type": "application/json", "x-real-ip": "203.0.113.5" },
        body: JSON.stringify({ channel: "telegram", target: "123456789" }),
      }),
    );
    const text = await response.text();

    expect(failingSend).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(502);
    expect(JSON.parse(text)).toEqual({ error: "Gagal mengirim notifikasi uji" });
    expect(text).not.toMatch(/ECONNREFUSED|telegram\.org|secret|at \//i);
  });
});
