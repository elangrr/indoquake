import { describe, expect, it, vi } from "vitest";
import { connectErrorCode, MIGRATIONS_FOLDER, runMigrations, withConnectRetry } from "../src/migrate";

const refused = () => Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5432"), { code: "ECONNREFUSED" });
const noSleep = () => Promise.resolve();

describe("withConnectRetry (A-M1: migrate waits for a starting database)", () => {
  it("retries a refused connect and returns the connection once it succeeds", async () => {
    const connect = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(refused())
      .mockRejectedValueOnce(refused())
      .mockRejectedValueOnce(refused())
      .mockResolvedValueOnce("connected");
    const onRetry = vi.fn();

    await expect(withConnectRetry(connect, { sleep: noSleep, onRetry })).resolves.toBe("connected");

    expect(connect).toHaveBeenCalledTimes(4);
    expect(onRetry.mock.calls).toEqual([
      [{ attempt: 1, delayMs: 250, code: "ECONNREFUSED" }],
      [{ attempt: 2, delayMs: 500, code: "ECONNREFUSED" }],
      [{ attempt: 3, delayMs: 1000, code: "ECONNREFUSED" }],
    ]);
  });

  it("gives up after the configured attempts with the last connect error", async () => {
    const connect = vi.fn<() => Promise<string>>().mockRejectedValue(refused());

    await expect(withConnectRetry(connect, { attempts: 3, sleep: noSleep, onRetry: () => undefined })).rejects.toThrow(
      "ECONNREFUSED",
    );
    expect(connect).toHaveBeenCalledTimes(3);
  });

  it("caps each delay at maxDelayMs", async () => {
    const connect = vi.fn<() => Promise<string>>().mockRejectedValue(refused());
    const sleep = vi.fn(noSleep);

    await expect(withConnectRetry(connect, { attempts: 10, sleep, onRetry: () => undefined })).rejects.toThrow();
    expect(sleep.mock.calls).toEqual([[250], [500], [1000], [2000], [4000], [5000], [5000], [5000], [5000]]);
  });

  it("fails at once on an SQL error", async () => {
    const sqlError = Object.assign(new Error('relation "x" does not exist'), { code: "42P01" });
    const connect = vi.fn<() => Promise<string>>().mockRejectedValue(sqlError);

    await expect(withConnectRetry(connect, { sleep: noSleep })).rejects.toBe(sqlError);
    expect(connect).toHaveBeenCalledTimes(1);
  });
});

describe("connectErrorCode", () => {
  it.each([
    ["refused", { code: "ECONNREFUSED" }, "ECONNREFUSED"],
    ["dns not ready", { code: "ENOTFOUND" }, "ENOTFOUND"],
    ["postgres starting up", { code: "57P03" }, "57P03"],
    ["aggregate of refused addresses", { errors: [{ code: "ECONNREFUSED" }] }, "ECONNREFUSED"],
    ["auth failure", { code: "28P01" }, null],
    ["syntax error", { code: "42601" }, null],
    ["plain string", "boom", null],
  ])("%s gives %s", (_label, error, expected) => {
    expect(connectErrorCode(error)).toBe(expected);
  });
});

describe("runMigrations connect retry", () => {
  it("retries a closed port and rejects with the connect error after the last attempt", async () => {
    const onRetry = vi.fn();

    await expect(
      runMigrations("postgres://u:p@127.0.0.1:1/db", MIGRATIONS_FOLDER, {
        retry: { attempts: 2, sleep: noSleep, onRetry },
      }),
    ).rejects.toMatchObject({ code: "ECONNREFUSED" });
    expect(onRetry.mock.calls).toEqual([[{ attempt: 1, delayMs: 250, code: "ECONNREFUSED" }]]);
  });
});
