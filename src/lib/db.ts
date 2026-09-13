import "server-only";
import { createClient, Store } from "./demo/engine";
import { schema, type DemoClient } from "./demo/schema";
import { seedDemoData } from "./demo/seed";

/**
 * Demo mode: there is no database.
 *
 * `db` answers the same queries the Prisma client did, from virtual data held
 * in this server process's memory. It is seeded on first use and lives until
 * the server restarts, or until the operator presses "Reset demo data".
 *
 * The store sits on globalThis because Next compiles pages, route handlers and
 * server actions into separate bundles, and in development it re-evaluates
 * modules on every save. All of them must see the one copy of the data.
 *
 * The database design this replaces is kept in archive/database-design,
 * with the steps to put it back.
 */

const globalForDemo = globalThis as unknown as { demoStore?: Store };

function store(): Store {
  if (!globalForDemo.demoStore) {
    const fresh = new Store(schema);
    seedDemoData(fresh);
    globalForDemo.demoStore = fresh;
  }
  return globalForDemo.demoStore;
}

export const db = createClient(schema, store) as unknown as DemoClient;

/** Puts the virtual data back to where the demo starts. */
export function resetDemoData(): void {
  const current = store();
  current.clear();
  seedDemoData(current);
}
