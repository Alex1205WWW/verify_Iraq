import { cache } from "react";
import { PrismaClient } from "@prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * One import, two runtimes.
 *
 * On Cloudflare Workers the database is D1. The D1 binding only exists inside
 * a request, and a PrismaClient must NOT outlive the request that made it:
 * reusing one across requests breaks later requests on Workers. So the client
 * is built per request and scoped with React's `cache`.
 *
 * Everywhere else - `next dev`, `next start`, the e2e suite - it is the SQLite
 * file named by DATABASE_URL through one long-lived client, exactly as before.
 *
 * `db` is a proxy so no caller has to change: `db.task.findMany()` resolves to
 * the right client at the moment it is used.
 */

type D1Binding = ConstructorParameters<typeof PrismaD1>[0];

function d1Binding(): D1Binding | undefined {
  try {
    const { env } = getCloudflareContext();
    return (env as unknown as { DB?: D1Binding }).DB;
  } catch {
    // Not inside Cloudflare. Fall through to the local SQLite file.
    return undefined;
  }
}

/** One D1-backed client per request, never shared between requests. */
const requestClient = cache((binding: D1Binding) => {
  return new PrismaClient({ adapter: new PrismaD1(binding) });
});

// Next.js hot-reloads modules in development, which would otherwise open a new
// pool on every save until SQLite refuses connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function localClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      log:
        process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
  }
  return globalForPrisma.prisma;
}

function resolveClient(): PrismaClient {
  const binding = d1Binding();
  return binding ? requestClient(binding) : localClient();
}

export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = resolveClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
