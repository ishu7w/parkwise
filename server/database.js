import { schema } from "./schema.js";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
let connection;
export async function database() {
  if (!connection)
    connection = connect().catch((e) => {
      connection = null;
      throw e;
    });
  return connection;
}
async function connect() {
  let db;
  if (process.env.DATABASE_URL) {
    const { default: pg } = await import("pg");
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      statement_timeout: 15000,
      lock_timeout: 8000,
    });
    db = {
      exec: (sql) => pool.query(sql),
      query: (sql, args = []) => pool.query(sql, args),
      transaction: async (fn) => {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const result = await fn(client);
          await client.query("COMMIT");
          return result;
        } catch (e) {
          await client.query("ROLLBACK");
          throw e;
        } finally {
          client.release();
        }
      },
      close: () => pool.end(),
    };
  } else {
    if (process.env.VERCEL || process.env.NODE_ENV === "production")
      throw Error("DATABASE_URL is required in production.");
    const { PGlite } = await import("@electric-sql/pglite");
    const localPath = process.env.LOCAL_DATABASE_PATH || ".data/parkwise";
    if (localPath !== "memory://")
      await mkdir(dirname(localPath), { recursive: true });
    const pg = new PGlite(localPath);
    db = {
      exec: (sql) => pg.exec(sql),
      query: (sql, args = []) => pg.query(sql, args),
      transaction: (fn) => pg.transaction(fn),
      close: () => pg.close(),
    };
  }
  if (process.env.DATABASE_URL)
    await db.transaction(async (tx) => {
      await tx.query("SELECT pg_advisory_xact_lock(7245998)");
      await tx.query(schema);
    });
  else await db.exec(schema);
  return db;
}
