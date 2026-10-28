// Runs the integration suites (*.int.test.ts, Testcontainers) when a Docker daemon answers.
// Without Docker: prints "SKIP: docker unavailable" and exits 0, or exits 2 when REQUIRE_DOCKER=1 (DECISIONS D5).
import { spawnSync } from "node:child_process";
import { request } from "node:http";

function socketPath() {
  const host = process.env.DOCKER_HOST ?? "unix:///var/run/docker.sock";
  return host.startsWith("unix://") ? host.slice("unix://".length) : null;
}

function ping() {
  const path = socketPath();
  if (!path) return Promise.resolve(true); // tcp DOCKER_HOST: let Testcontainers decide
  return new Promise((resolve) => {
    const req = request({ socketPath: path, path: "/_ping", timeout: 3000 }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

if (!(await ping())) {
  console.log("SKIP: docker unavailable");
  process.exit(process.env.REQUIRE_DOCKER === "1" ? 2 : 0);
}

const result = spawnSync("npm", ["run", "test:int", "--workspaces", "--if-present"], {
  stdio: "inherit",
  env: { ...process.env, TESTCONTAINERS_RYUK_DISABLED: process.env.TESTCONTAINERS_RYUK_DISABLED ?? "false" },
});
process.exit(result.status ?? 1);
