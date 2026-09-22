import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "apps/web/**",
      "packages/database/drizzle/**",
    ],
  },
  ...tseslint.configs.recommended,
);
