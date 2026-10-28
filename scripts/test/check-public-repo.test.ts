import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT = join(import.meta.dirname, "..", "check-public-repo.mjs");
const KEY_HEADER = "-----BEGIN OPENSSH " + "PRIVATE KEY-----";
// Fixtures are assembled at runtime so this file passes the check it tests.
const dotted = (...parts: string[]) => parts.join(".");

function repoWith(content: string, name = "notes.md"): string {
  const dir = mkdtempSync(join(tmpdir(), "public-repo-"));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  writeFileSync(join(dir, name), content);
  execFileSync("git", ["add", name], { cwd: dir });
  return dir;
}

function check(dir: string): { status: number | null; stdout: string } {
  const result = spawnSync("node", [SCRIPT, dir], { encoding: "utf8" });
  return { status: result.status, stdout: result.stdout };
}

describe("check-public-repo CLI", () => {
  it.each([
    ["a public IPv4 address", "ssh root@" + dotted("8", "8", "4", "4"), "IPv4 address"],
    ["a private-network IPv4 address", "host " + dotted("10", "1", "2", "3"), "IPv4 address"],
    ["a PuTTY key file", "key: C:/keys/vps." + "ppk", "PuTTY key file"],
    ["a private key block", KEY_HEADER, "private key block"],
    ["a Windows user path", "C:\\" + "Users\\someone\\Downloads", "Windows user path"],
    ["a literal password", "pass" + "word=hunter2", "literal password"],
  ])("fails on %s", (_label, content, reason) => {
    const result = check(repoWith(content));
    expect(result.status).toBe(1);
    expect(result.stdout).toContain(reason);
  });

  it.each([
    ["loopback and documentation addresses", "127.0.0.1:3410 192.0.2.10 198.51.100.7 203.0.113.9", "notes.md"],
    ["a password taken from the environment", "password=${POSTGRES_PASSWORD}", "notes.md"],
    ["svg path data", '<path d="M' + dotted("1", "5", "75", "75") + ' 0"/>', "icon.svg"],
  ])("passes on %s", (_label, content, name) => {
    expect(check(repoWith(content, name)).status).toBe(0);
  });
});
