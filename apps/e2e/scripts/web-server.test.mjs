import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { startWebServer } from "./web-server.mjs";

const TREE_SERVER = fileURLToPath(new URL("./fixtures/tree-server.mjs", import.meta.url));
const CRASH_AFTER_START = fileURLToPath(new URL("./fixtures/crash-after-start.mjs", import.meta.url));

async function answers(port) {
  return fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(1_000) }).then(
    () => true,
    () => false,
  );
}

function treeServer(port) {
  return { command: process.execPath, args: [TREE_SERVER, String(port)], port, stdio: "ignore", readyPath: "/", timeoutMs: 10_000 };
}

describe("startWebServer", () => {
  it("stop() frees the port when the listening process is a grandchild", async () => {
    const server = await startWebServer(treeServer(3491));
    expect(await answers(3491)).toBe(true);
    await server.stop();
    expect(await answers(3491)).toBe(false);
  });

  it("starts again on the same port right after a stop", async () => {
    const first = await startWebServer(treeServer(3492));
    await first.stop();
    const second = await startWebServer(treeServer(3492));
    expect(await answers(3492)).toBe(true);
    await second.stop();
    expect(await answers(3492)).toBe(false);
  });

  it("a script that throws after starting the server leaves the port free", async () => {
    const run = spawnSync(process.execPath, [CRASH_AFTER_START, "3493"], { encoding: "utf8", timeout: 20_000 });
    expect(run.stdout).toContain("STARTED");
    expect(run.status).toBe(1);
    await expect.poll(() => answers(3493), { timeout: 5_000 }).toBe(false);
  });

  it("refuses a port where an earlier server still answers", async () => {
    const server = await startWebServer(treeServer(3494));
    await expect(startWebServer(treeServer(3494))).rejects.toThrow("port 3494 already answers");
    await server.stop();
  });
});
