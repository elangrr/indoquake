// Fails when a tracked file holds host facts or secrets that must not be in a public repo (SPEC D17, A-23).
// Usage: node scripts/check-public-repo.mjs [repoDir]
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoDir = process.argv[2] ?? process.cwd();

const IPV4 = /(?<![\d.])(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?![\d.])/g;
const PRIVATE_KEY = new RegExp("BEGIN [A-Z ]*" + "PRIVATE KEY");
const PPK = new RegExp("\\." + "ppk\\b", "i"); // split so this file passes its own check
const WINDOWS_USER_PATH = /[A-Za-z]:\\+Users\\+[^\\\s"']+/;
const PASSWORD_LITERAL = /password\s*=\s*(?!["']?\$\{|["']?\$[A-Z_]|<|"?\s*$|'?\s*$)["']?[^\s"'#]+/i;

function allowedIp(octets) {
  const [a, b, c] = octets;
  if (octets.some((part) => part > 255)) return true; // not an address (version string)
  if (a === 127) return true; // loopback
  if (a === 0 && b === 0 && c === 0 && octets[3] === 0) return true; // bind-all
  if (a === 192 && b === 0 && c === 2) return true; // TEST-NET-1
  if (a === 198 && b === 51 && c === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true; // TEST-NET-3
  return false;
}

export function findIssues(path, text) {
  const issues = [];
  const checkIp = !path.endsWith(".svg"); // svg path data looks like dotted quads
  const lines = text.split("\n");
  lines.forEach((line, index) => {
    const where = `${path}:${index + 1}`;
    for (const match of checkIp ? line.matchAll(IPV4) : []) {
      const octets = match.slice(1, 5).map(Number);
      if (!allowedIp(octets)) issues.push(`${where}: IPv4 address ${match[0]}`);
    }
    if (PRIVATE_KEY.test(line)) issues.push(`${where}: private key block`);
    if (PPK.test(line)) issues.push(`${where}: PuTTY key file reference`);
    if (WINDOWS_USER_PATH.test(line)) issues.push(`${where}: Windows user path`);
    if (PASSWORD_LITERAL.test(line)) issues.push(`${where}: literal password`);
  });
  return issues;
}

const files = execFileSync("git", ["ls-files", "-z"], { cwd: repoDir, encoding: "utf8" })
  .split("\0")
  .filter((file) => file !== "" && file !== "package-lock.json");

const issues = [];
for (const file of files) {
  let text;
  try {
    text = readFileSync(join(repoDir, file), "utf8");
  } catch {
    continue; // deleted in the working tree
  }
  if (text.includes("\0")) continue; // binary
  issues.push(...findIssues(file, text));
}

if (issues.length > 0) {
  for (const issue of issues) console.log(`public-repo: ${issue}`);
  console.log(`public-repo: FAIL (${issues.length} issue(s))`);
  process.exit(1);
}
console.log(`public-repo: OK (${files.length} tracked files checked)`);
