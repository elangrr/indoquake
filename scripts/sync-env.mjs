import { copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = `${root}.env`;
const target = `${root}apps/web/.env.local`;

if (!existsSync(source)) {
  console.error("File .env belum ada di root. Salin dari .env.example lalu isi.");
  process.exit(1);
}

copyFileSync(source, target);
console.log("apps/web/.env.local disalin dari .env");
