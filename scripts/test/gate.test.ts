import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const GATE = join(import.meta.dirname, "..", "gate.sh");

describe("gate.sh", () => {
  it("ends with GATE FAIL <step> and a non-zero exit when a step fails", () => {
    const result = spawnSync("bash", [GATE, "--bogus"], { encoding: "utf8" });
    expect(result.status).toBe(64);
    expect(result.stdout.trim().split("\n").at(-1)).toBe("GATE FAIL args");
  });
});
