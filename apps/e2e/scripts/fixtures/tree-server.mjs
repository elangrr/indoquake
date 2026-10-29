// Test fixture: an HTTP server one process below its parent, like npm -> sh -> next.
// Usage: node tree-server.mjs <port> [--throw-after-start]
import { spawn } from "node:child_process";
import { createServer } from "node:http";

const [port, flag] = process.argv.slice(2);
if (flag === "--child") {
  createServer((_request, response) => response.end("ok")).listen(Number(port), "127.0.0.1");
} else {
  spawn(process.execPath, [import.meta.filename, port, "--child"], { stdio: "ignore" });
}
