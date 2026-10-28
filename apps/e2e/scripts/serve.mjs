// e2e:serve (B-24): PostGIS + Redis via Testcontainers, repo migrations, >= 100 seeded quakes,
// `next start` on 127.0.0.1:<port>; prints READY <url> and stays up until SIGTERM.
// Usage: npm run e2e:serve -w @indoquake/e2e -- --port 3418
import { spawn } from "node:child_process";

import { dockerAvailable, migrate, REPO_ROOT, seed, startStack } from "./stack.mjs";

const portFlag = process.argv.indexOf("--port");
const port = Number(portFlag > -1 ? process.argv[portFlag + 1] : 3418);

if (!(await dockerAvailable())) {
  console.log("SKIP: docker unavailable");
  process.exit(process.env.REQUIRE_DOCKER === "1" ? 2 : 0);
}

const stack = await startStack();
await migrate(stack.databaseUrl);
const keys = await seed(stack.databaseUrl, 120);
const web = spawn("npm", ["run", "start", "-w", "@indoquake/web", "--", "-H", "127.0.0.1", "-p", String(port)], {
  cwd: REPO_ROOT,
  env: { ...process.env, DATABASE_URL: stack.databaseUrl, REDIS_URL: stack.redisUrl, NEXT_TELEMETRY_DISABLED: "1" },
  stdio: ["ignore", "inherit", "inherit"],
});

const url = `http://127.0.0.1:${port}`;
for (let attempt = 0; attempt < 120; attempt += 1) {
  const ok = await fetch(`${url}/robots.txt`).then((response) => response.ok, () => false);
  if (ok) break;
  await new Promise((resolve) => setTimeout(resolve, 500));
}
console.log(`SEEDED ${keys.length} first=${keys[0]}`);
console.log(`READY ${url}`);

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  web.kill("SIGTERM");
  await stack.stop();
  process.exit(0);
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
web.on("exit", stop);
