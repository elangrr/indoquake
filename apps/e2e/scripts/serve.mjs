// e2e:serve (B-24): PostGIS + Redis via Testcontainers, repo migrations, >= 100 seeded quakes,
// `next start` on 127.0.0.1:<port>; prints READY <url> and stays up until SIGTERM or SIGINT.
// Stopping (signal, server exit or a startup failure) stops the web server and the containers.
// Usage: npm run e2e:serve -w @indoquake/e2e -- --port 3418
import { dockerAvailable, migrate, REPO_ROOT, seed, startStack } from "./stack.mjs";
import { startWebServer } from "./web-server.mjs";

const portFlag = process.argv.indexOf("--port");
const port = Number(portFlag > -1 ? process.argv[portFlag + 1] : 3418);

if (!(await dockerAvailable())) {
  console.log("SKIP: docker unavailable");
  process.exit(process.env.REQUIRE_DOCKER === "1" ? 2 : 0);
}

const stack = await startStack();
let web = null;
let stopping = false;
async function stop(code) {
  if (stopping) return;
  stopping = true;
  await web?.stop();
  await stack.stop();
  process.exit(code);
}
process.on("SIGTERM", () => void stop(0));
process.on("SIGINT", () => void stop(0));

try {
  await migrate(stack.databaseUrl);
  const keys = await seed(stack.databaseUrl, 120);
  web = await startWebServer({
    command: "npm",
    args: ["run", "start", "-w", "@indoquake/web", "--", "-H", "127.0.0.1", "-p", String(port)],
    port,
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL: stack.databaseUrl, REDIS_URL: stack.redisUrl, NEXT_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", "inherit", "inherit"],
  });
  console.log(`SEEDED ${keys.length} first=${keys[0]}`);
  console.log(`READY ${web.url}`);
  void web.exited.then(() => stop(1));
} catch (error) {
  console.error(error);
  await stop(1);
}
