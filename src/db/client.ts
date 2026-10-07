import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Shared Postgres pool. Reused across hot reloads in dev so we don't exhaust connections.
 * Scripts (seed, import) import this too, so it reads DATABASE_URL directly rather than via
 * the server-only config module.
 */
const globalForDb = globalThis as unknown as { __pg?: ReturnType<typeof postgres> };

const client =
  globalForDb.__pg ??
  postgres(process.env.DATABASE_URL!, {
    max: Number(process.env.DB_POOL_SIZE ?? 10),
    onnotice: () => {},
  });
if (process.env.NODE_ENV !== "production") globalForDb.__pg = client;

export const db = drizzle(client, { schema, casing: "snake_case" });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export { schema, client as pg };
