// Copies the self-hosted variable fonts from fontsource into src/lib/fonts,
// so `next build` never fetches fonts over the network.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const target = join(here, "..", "src", "lib", "fonts");

const FONTS = [
  ["@fontsource-variable/archivo", "archivo-latin-wght-normal.woff2"],
  ["@fontsource-variable/martian-mono", "martian-mono-latin-wght-normal.woff2"],
];

mkdirSync(target, { recursive: true });
for (const [pkg, file] of FONTS) {
  const pkgDir = dirname(require.resolve(`${pkg}/package.json`));
  copyFileSync(join(pkgDir, "files", file), join(target, file));
  console.log(`copied ${pkg}/${file}`);
}
