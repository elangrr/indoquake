// e2e:full: the `full` project against a real stack. Uses E2E_BASE_URL + E2E_DATABASE_URL +
// E2E_REDIS_URL when given; otherwise starts its own stack with Testcontainers. Without Docker
// it prints SKIP and exits 0 (REQUIRE_DOCKER=1: exit 2).
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { dockerAvailable, migrate, REPO_ROOT, seed, startStack } from "./stack.mjs";

const e2eDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const extra = process.argv.slice(2);

function playwright(env) {
  return new Promise((resolve) => {
    const child = spawn("npx", ["playwright", "test", "--project=full", ...extra], { cwd: e2eDir, env, stdio: "inherit" });
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

if (process.env.E2E_BASE_URL && process.env.E2E_DATABASE_URL && process.env.E2E_REDIS_URL) {
  process.exit(await playwright(process.env));
}
if (!(await dockerAvailable())) {
  console.log("SKIP: docker unavailable (e2e full)");
  process.exit(process.env.REQUIRE_DOCKER === "1" ? 2 : 0);
}
const stack = await startStack();
let code = 1;
try {
  await migrate(stack.databaseUrl);
  const keys = await seed(stack.databaseUrl, 120);
  const port = Number(process.env.E2E_PORT ?? 3419);
  const web = spawn("npm", ["run", "start", "-w", "@indoquake/web", "--", "-H", "127.0.0.1", "-p", String(port)], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL: stack.databaseUrl, REDIS_URL: stack.redisUrl, NEXT_TELEMETRY_DISABLED: "1" },
    stdio: "inherit",
  });
  const url = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (await fetch(`${url}/robots.txt`).then((r) => r.ok, () => false)) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  code = await playwright({
    ...process.env,
    E2E_BASE_URL: url,
    E2E_DATABASE_URL: stack.databaseUrl,
    E2E_REDIS_URL: stack.redisUrl,
    E2E_SEEDED_KEY: keys[0],
  });
  web.kill("SIGTERM");
} finally {
  await stack.stop();
}
process.exit(code);
