#!/usr/bin/env node
// Applies database migrations. Carewish also applies them automatically on
// first use, so this is only needed to migrate ahead of a deploy.
//   DATABASE_URL=postgres://… node scripts/migrate.mjs   (Node 22.18+)
import pg from 'pg';
import { migrate } from '../src/server/db.ts';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = {
  query: (text, params) => pool.query(text, params),
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
try {
  const applied = await migrate(db);
  console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Database is up to date.');
} finally {
  await pool.end();
}
