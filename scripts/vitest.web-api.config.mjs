// Route tests for apps/web/src/app/api (A-18): run from the root `npm test`. apps/web has no test
// runner of its own, so this config resolves the web "@/..." alias for those files only.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const web = fileURLToPath(new URL("../apps/web", import.meta.url));

export default defineConfig({
  root: web,
  resolve: { alias: { "@": `${web}/src` } },
  test: { include: ["src/app/api/**/*.test.ts"], environment: "node" },
});
