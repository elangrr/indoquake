import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3417);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

const chromium = { ...devices["Desktop Chrome"] };

export default defineConfig({
  testDir: "./tests",
  outputDir: "./test-results",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 2,
  reporter: [["list"]],
  use: { baseURL: BASE_URL, trace: "off" },
  projects: [
    { name: "mocked", testDir: "./tests/mocked", use: chromium },
    { name: "full", testDir: "./tests/full", use: chromium },
    { name: "shots", testDir: "./tests/shots", use: chromium },
  ],
  // mocked and shots: the production web server without a database; every browser call to
  // /api/v1 is answered by the test (support/mock.ts). full: E2E_BASE_URL from e2e:serve.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run start -w @indoquake/web -- -H 127.0.0.1 -p ${PORT}`,
        cwd: join(import.meta.dirname, "..", ".."),
        url: `${BASE_URL}/robots.txt`,
        reuseExistingServer: false,
        timeout: 60_000,
        env: { NEXT_TELEMETRY_DISABLED: "1", DATABASE_URL: "", REDIS_URL: "" },
      },
});
