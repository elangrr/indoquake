import { defineConfig } from "vitest/config";

// Unit runs skip *.int.test.ts; `npm run test:int` (VITEST_INTEGRATION=1) runs only them.
const integration = process.env.VITEST_INTEGRATION === "1";

export default defineConfig({
  test: integration
    ? { include: ["**/*.int.test.ts"], testTimeout: 120_000, hookTimeout: 240_000, fileParallelism: false }
    : { include: ["**/*.test.ts"], exclude: ["**/node_modules/**", "**/*.int.test.ts"] },
});
