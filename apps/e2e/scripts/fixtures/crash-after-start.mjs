// Test fixture: a script that starts the server and then fails, like run-full.mjs when seeding throws.
import { startWebServer } from "../web-server.mjs";

const port = Number(process.argv[2]);
await startWebServer({ command: process.execPath, args: [new URL("./tree-server.mjs", import.meta.url).pathname, String(port)], port, stdio: "ignore", readyPath: "/" });
console.log("STARTED");
throw new Error("seed failed");
