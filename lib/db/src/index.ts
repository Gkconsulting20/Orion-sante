import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import { AsyncLocalStorage } from "node:async_hooks";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const nodeDb = drizzle(pool, { schema });
const requestDb = new AsyncLocalStorage<typeof nodeDb>();

// Workers cannot reuse sockets created by another request. Keep the existing
// Node pool, but resolve the database from request-local storage on Workers.
export const db: typeof nodeDb = new Proxy(nodeDb, {
  get(target, property) {
    const current = requestDb.getStore() ?? target;
    const value = Reflect.get(current, property);
    return typeof value === "function" ? value.bind(current) : value;
  },
});

export async function withRequestDatabase<T>(
  connectionString: string,
  action: () => Promise<T>,
): Promise<T> {
  const requestPool = new Pool({
    connectionString,
    max: 2,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 1000,
  });
  try {
    return await requestDb.run(drizzle(requestPool, { schema }), action);
  } finally {
    await requestPool.end();
  }
}

export * from "./schema";
