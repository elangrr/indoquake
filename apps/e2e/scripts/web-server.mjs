// Start and stop the web server for the e2e scripts (run-full.mjs, serve.mjs).
// `npm run start` is npm -> sh -> next: killing only the npm pid can leave next holding the port.
// The server runs in its own process group and every stop path signals the whole group:
// stop(), normal exit, and a throw or process.exit anywhere in the calling script.
import { spawn } from "node:child_process";

const STOP_GRACE_MS = 10_000;

async function answers(url) {
  return fetch(url, { signal: AbortSignal.timeout(1_000) }).then(
    () => true,
    () => false,
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Spawn `command args` in a new process group and wait until http://127.0.0.1:<port><readyPath> answers OK.
 * Rejects (after stopping what it started) when the port already answers, the server exits early,
 * or it is not ready within `timeoutMs`.
 * `exited` resolves when the spawned process ends (for scripts that stop when the server dies).
 * @returns {Promise<{ url: string, stop: () => Promise<void>, exited: Promise<void> }>}
 */
export async function startWebServer({ command, args, port, cwd, env, stdio = "inherit", readyPath = "/robots.txt", timeoutMs = 60_000 }) {
  const url = `http://127.0.0.1:${port}`;
  if (await answers(url)) {
    throw new Error(`port ${port} already answers: an earlier server is still running, stop it first`);
  }

  const child = spawn(command, args, { cwd, env, stdio, detached: true });
  let exited = false;
  const exitedPromise = new Promise((resolve) => {
    child.once("exit", () => {
      exited = true;
      resolve();
    });
  });

  const signalGroup = (signal) => {
    try {
      process.kill(-child.pid, signal);
    } catch {
      // the group is already gone
    }
  };
  // Last resort when the script ends without calling stop(): exit handlers must be synchronous.
  const killOnExit = () => signalGroup("SIGKILL");
  process.on("exit", killOnExit);

  let stopped = false;
  async function stop() {
    if (stopped) return;
    stopped = true;
    signalGroup("SIGTERM");
    await Promise.race([exitedPromise, sleep(STOP_GRACE_MS)]);
    // npm may exit before next does: always finish the whole group.
    signalGroup("SIGKILL");
    process.off("exit", killOnExit);
    for (let attempt = 0; attempt < 20 && (await answers(url)); attempt += 1) await sleep(250);
  }

  const deadline = Date.now() + timeoutMs;
  while (!(await answers(`${url}${readyPath}`))) {
    if (exited || Date.now() > deadline) {
      await stop();
      throw new Error(exited ? `web server exited before ${url} was ready` : `web server not ready on ${url} after ${timeoutMs} ms`);
    }
    await sleep(500);
  }
  return { url, stop, exited: exitedPromise };
}
