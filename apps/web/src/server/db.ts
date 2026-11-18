import { MIGRATIONS } from './migrations.ts';

/** The minimal database surface Carewish needs; satisfied by `pg` and by PGlite in tests. */
export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
  /** Runs one or more statements without parameters. */
  exec(sql: string): Promise<unknown>;
}

const MIGRATION_LOCK = 728_311;

/** Applies pending migrations inside one transaction, guarded by an advisory lock. */
export async function migrate(db: Db): Promise<string[]> {
  await db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  const { rows } = await db.query<{ id: string }>('SELECT id FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.id));
  const pending = MIGRATIONS.filter((m) => !applied.has(m.id));
  for (const m of pending) {
    await db
      .exec(
        `BEGIN;
      SELECT pg_advisory_xact_lock(${MIGRATION_LOCK});
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM schema_migrations WHERE id = '${m.id}') THEN
          RAISE EXCEPTION 'carewish:already-applied';
        END IF;
      END $$;
      ${m.sql}
      INSERT INTO schema_migrations (id) VALUES ('${m.id}');
    COMMIT;`,
      )
      .catch(async (error: unknown) => {
        await db.exec('ROLLBACK').catch(() => undefined);
        if (!String(error).includes('carewish:already-applied')) throw error;
      });
  }
  return pending.map((m) => m.id);
}

/** Accounts are enabled when the server has a database. */
export function accountsEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

let ready: Promise<Db> | undefined;
let override: Db | undefined;

/** Uses a specific database (tests). Pass undefined to reset. */
export function setDb(db: Db | undefined): void {
  override = db;
  ready = undefined;
}

export async function getDb(): Promise<Db> {
  if (override) return override;
  ready ??= (async () => {
    const { Pool } = await import('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
      ssl:
        process.env.DATABASE_SSL === 'true'
          ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' }
          : undefined,
    });
    const db: Db = {
      query: (text, params) => pool.query(text, params as unknown[]) as never,
      // multi-statement scripts run on one connection, rolled back on failure
      exec: async (sql) => {
        const client = await pool.connect();
        try {
          return await client.query(sql);
        } catch (error) {
          await client.query('ROLLBACK').catch(() => undefined);
          throw error;
        } finally {
          client.release();
        }
      },
    };
    await migrate(db);
    return db;
  })().catch((error: unknown) => {
    ready = undefined;
    throw error;
  });
  return ready;
}
