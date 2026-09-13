/**
 * Boots a production server against a throwaway copy of the database, runs the
 * functional suite against it, then shuts down. The real dev database is never
 * touched, so the suite can be run while the app is open in a browser.
 */
import { spawn } from "node:child_process";
import { copyFileSync, existsSync, rmSync } from "node:fs";
import process from "node:process";

const PORT = process.env.TEST_PORT ?? "3200";
const BASE = `http://127.0.0.1:${PORT}`;

if (!existsSync("prisma/dev.db")) {
  console.error("No prisma/dev.db — run `npm run setup` first.");
  process.exit(1);
}
// SQLite keeps committed pages in the -wal sidecar, so replacing only the
// main file leaves the previous run's data alive. Clear all of them.
for (const suffix of ["", "-wal", "-shm", "-journal"]) {
  try {
    rmSync("prisma/test.db" + suffix, { force: true });
  } catch {
    console.error("prisma/test.db is locked — another server still has it open.");
    process.exit(1);
  }
}
copyFileSync("prisma/dev.db", "prisma/test.db");

// Refuse to run if something already owns the port. Otherwise the suite
// silently tests a stranger's server against a database it does not control,
// and the results drift for no visible reason.
try {
  const probe = await fetch(BASE + "/login", { signal: AbortSignal.timeout(1500) });
  if (probe) {
    console.error(`Port ${PORT} is already in use. Stop that server, or set TEST_PORT.`);
    process.exit(1);
  }
} catch {
  /* nothing listening, which is what we want */
}

const env = { ...process.env, DATABASE_URL: "file:./test.db", TEST_BASE: BASE };
const server = spawn("npx", ["next", "start", "-p", PORT], {
  env, stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32",
});
let log = "";
server.stdout.on("data", (d) => (log += d));
server.stderr.on("data", (d) => (log += d));

async function waitForServer() {
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(BASE + "/login");
      if (r.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function shutdown(code) {
  server.kill();
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    try { rmSync("prisma/test.db" + suffix, { force: true }); } catch { /* ignore */ }
  }
  process.exit(code);
}

if (!(await waitForServer())) {
  console.error("Server never came up:\n" + log);
  shutdown(1);
}

const suite = spawn("node", ["test/run.mjs"], { env, stdio: "inherit" });
suite.on("exit", (code) => {
  // Guard tests deliberately make actions throw, and Next logs those. Only
  // faults the app should never produce are worth reporting.
  const bad = log
    .split(/\r?\n/)
    .filter((l) =>
      /window is not defined|unhandledRejection|invalid-use-server|Cannot read propert/.test(l),
    );
  if (bad.length) {
    console.log(`\nUnexpected server-side errors (${bad.length}):`);
    for (const l of bad.slice(0, 8)) console.log("  " + l.trim());
  } else {
    console.log("\nNo unexpected server-side errors.");
  }
  shutdown(code ?? 1);
});
