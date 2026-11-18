import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { migrate, setDb, type Db } from '@/server/db';
import {
  decoySalt,
  hashAuthKey,
  verifyAuthKey,
  createSession,
  getSessionUser,
} from '@/server/auth';
import { RateLimiter, authLimiter, writeLimiter, shareReadLimiter } from '@/server/rate-limit';
import { MIGRATIONS } from '@/server/migrations';
import * as health from '@/app/api/health/route';
import * as config from '@/app/api/config/route';
import * as params from '@/app/api/auth/params/route';
import * as register from '@/app/api/auth/register/route';
import * as login from '@/app/api/auth/login/route';
import * as logout from '@/app/api/auth/logout/route';
import * as session from '@/app/api/auth/session/route';
import * as vault from '@/app/api/vault/route';
import * as account from '@/app/api/account/route';
import * as shares from '@/app/api/shares/route';
import * as shareById from '@/app/api/shares/[id]/route';

const ORIGIN = 'http://carewish.test';
let pg: PGlite;
let db: Db;
let ip = 0;

function req(
  path: string,
  init: {
    method?: string;
    body?: unknown;
    cookie?: string;
    origin?: string;
    headers?: Record<string, string>;
  } = {},
): Request {
  const headers: Record<string, string> = {
    host: 'carewish.test',
    'x-forwarded-for': `10.0.0.${ip}`,
    ...init.headers,
  };
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  if (init.cookie) headers.cookie = init.cookie;
  if (init.origin !== undefined) headers.origin = init.origin;
  return new Request(`${ORIGIN}${path}`, {
    method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
    headers,
    body:
      init.body === undefined
        ? undefined
        : typeof init.body === 'string'
          ? init.body
          : JSON.stringify(init.body),
  });
}

const cookieOf = (res: Response) => res.headers.get('set-cookie')?.split(';')[0] ?? '';
const AUTH_KEY = 'A'.repeat(43);
const SALT = 'B'.repeat(22);
const IV = 'C'.repeat(16);
const CT = 'D'.repeat(64);

async function signUp(email = 'maria@example.com'): Promise<string> {
  const res = await register.POST(
    req('/api/auth/register', {
      body: { email, salt: SALT, iterations: 600_000, authKey: AUTH_KEY },
    }),
  );
  expect(res.status).toBe(201);
  return cookieOf(res);
}

beforeAll(async () => {
  process.env.DATABASE_URL = 'postgres://pglite/test';
  pg = new PGlite();
  db = { query: (text, p) => pg.query(text, p as unknown[]) as never, exec: (sql) => pg.exec(sql) };
  setDb(db);
});

afterAll(async () => {
  setDb(undefined);
  delete process.env.DATABASE_URL;
  await pg.close();
});

beforeEach(async () => {
  ip += 1;
  await migrate(db);
  await db.exec('DELETE FROM users');
});

describe('migrations', () => {
  it('apply once and are idempotent', async () => {
    expect(await migrate(db)).toEqual([]);
    const { rows } = await db.query<{ id: string }>('SELECT id FROM schema_migrations ORDER BY id');
    expect(rows.map((r) => r.id)).toEqual(MIGRATIONS.map((m) => m.id));
  });
});

describe('auth primitives', () => {
  it('hashes and verifies auth keys', async () => {
    const hash = await hashAuthKey(AUTH_KEY);
    expect(hash).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(await verifyAuthKey(AUTH_KEY, hash)).toBe(true);
    expect(await verifyAuthKey('x'.repeat(43), hash)).toBe(false);
    expect(await verifyAuthKey(AUTH_KEY, 'garbage')).toBe(false);
  });

  it('derives stable decoy salts', () => {
    expect(decoySalt('a@b.co')).toBe(decoySalt('a@b.co'));
    expect(decoySalt('a@b.co')).not.toBe(decoySalt('c@d.co'));
  });

  it('expires sessions', async () => {
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO users (id, email, kdf_salt, kdf_iterations, auth_hash) VALUES (gen_random_uuid(), 'x@y.co', 's', 600000, 'h') RETURNING id`,
    );
    const past = new Date('2020-01-01T00:00:00Z');
    const token = await createSession(db, rows[0]!.id, past);
    expect(await getSessionUser(db, token, past)).toMatchObject({ email: 'x@y.co' });
    expect(await getSessionUser(db, token)).toBeNull();
    expect(await getSessionUser(db, undefined)).toBeNull();
    expect(await getSessionUser(db, 'x'.repeat(200))).toBeNull();
  });

  it('rate limits within a window', () => {
    const limiter = new RateLimiter(2, 1000);
    expect(limiter.allow('k', 0)).toBe(true);
    expect(limiter.allow('k', 1)).toBe(true);
    expect(limiter.allow('k', 2)).toBe(false);
    expect(limiter.allow('k', 1500)).toBe(true);
    expect(
      [authLimiter, writeLimiter, shareReadLimiter].every((l) => l instanceof RateLimiter),
    ).toBe(true);
  });
});

describe('API', () => {
  it('reports health and configuration', async () => {
    const h = await health.GET();
    expect(h.status).toBe(200);
    expect(await h.json()).toMatchObject({
      status: 'ok',
      accounts: true,
      database: 'ok',
      version: expect.any(String),
    });
    expect(await config.GET().json()).toEqual({ accounts: true });
  });

  it('registers, signs in, signs out', async () => {
    const cookie = await signUp();
    expect(cookie).toMatch(/^cw_session=/);
    const me = await session.GET(req('/api/auth/session', { cookie }));
    expect(await me.json()).toEqual({ email: 'maria@example.com' });

    const dup = await register.POST(
      req('/api/auth/register', {
        body: { email: 'MARIA@example.com', salt: SALT, iterations: 600_000, authKey: AUTH_KEY },
      }),
    );
    expect(dup.status).toBe(409);

    const p = await params.POST(req('/api/auth/params', { body: { email: 'Maria@Example.com' } }));
    expect(await p.json()).toEqual({ salt: SALT, iterations: 600_000 });

    const bad = await login.POST(
      req('/api/auth/login', { body: { email: 'maria@example.com', authKey: 'Z'.repeat(43) } }),
    );
    expect(bad.status).toBe(401);
    const good = await login.POST(
      req('/api/auth/login', { body: { email: 'maria@example.com', authKey: AUTH_KEY } }),
    );
    expect(good.status).toBe(200);
    const cookie2 = cookieOf(good);
    expect(good.headers.get('set-cookie')).toMatch(/HttpOnly; SameSite=Strict/);

    const out = await logout.POST(
      req('/api/auth/logout', { method: 'POST', body: {}, cookie: cookie2 }),
    );
    expect(out.headers.get('set-cookie')).toMatch(/Max-Age=0/);
    expect((await session.GET(req('/api/auth/session', { cookie: cookie2 }))).status).toBe(401);
  });

  it('does not reveal which emails exist', async () => {
    const res = await params.POST(
      req('/api/auth/params', { body: { email: 'nobody@example.com' } }),
    );
    const body = await res.json();
    expect(body.iterations).toBe(600_000);
    expect(body.salt).toBe(decoySalt('nobody@example.com'));
    const unknown = await login.POST(
      req('/api/auth/login', { body: { email: 'nobody@example.com', authKey: AUTH_KEY } }),
    );
    expect(unknown.status).toBe(401);
  });

  it('validates input', async () => {
    const cases = [
      { email: 'not-an-email', salt: SALT, iterations: 600_000, authKey: AUTH_KEY },
      { email: 'a@b.co', salt: 'short', iterations: 600_000, authKey: AUTH_KEY },
      { email: 'a@b.co', salt: SALT, iterations: 1000, authKey: AUTH_KEY },
      { email: 'a@b.co', salt: SALT, iterations: 600_000, authKey: 'bad key!' },
    ];
    for (const body of cases)
      expect((await register.POST(req('/api/auth/register', { body }))).status).toBe(400);
    expect((await register.POST(req('/api/auth/register', { body: '{not json' }))).status).toBe(
      400,
    );
    expect((await register.POST(req('/api/auth/register', { body: '[]' }))).status).toBe(400);
    const textPlain = new Request(`${ORIGIN}/api/auth/params`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain', host: 'carewish.test' },
      body: '{}',
    });
    expect((await params.POST(textPlain)).status).toBe(415);
    expect((await params.POST(req('/api/auth/params', { body: { email: 5 } }))).status).toBe(400);
    expect((await login.POST(req('/api/auth/login', { body: { email: 'a@b.co' } }))).status).toBe(
      400,
    );
    const huge = await register.POST(
      req('/api/auth/register', { body: { pad: 'x'.repeat(20_000) } }),
    );
    expect(huge.status).toBe(413);
  });

  it('blocks cross-site writes', async () => {
    const res = await register.POST(
      req('/api/auth/register', { origin: 'https://evil.example', body: { email: 'a@b.co' } }),
    );
    expect(res.status).toBe(403);
    const malformed = await register.POST(
      req('/api/auth/register', { origin: 'not a url', body: { email: 'a@b.co' } }),
    );
    expect(malformed.status).toBe(403);
    const same = await params.POST(
      req('/api/auth/params', { origin: ORIGIN, body: { email: 'a@b.co' } }),
    );
    expect(same.status).toBe(200);
  });

  it('rate limits sign-in attempts', async () => {
    let last = 0;
    for (let i = 0; i < 12; i++) {
      last = (
        await login.POST(
          req('/api/auth/login', { body: { email: 'rate@example.com', authKey: AUTH_KEY } }),
        )
      ).status;
    }
    expect(last).toBe(429);
  });

  it('stores the vault with optimistic concurrency', async () => {
    const cookie = await signUp();
    expect((await vault.GET(req('/api/vault', { cookie }))).status).toBe(404);
    expect((await vault.GET(req('/api/vault'))).status).toBe(401);

    const first = await vault.PUT(
      req('/api/vault', {
        method: 'PUT',
        cookie,
        body: { iv: IV, ciphertext: CT, baseRevision: 0 },
      }),
    );
    expect(await first.json()).toMatchObject({ revision: 1 });
    const again = await vault.PUT(
      req('/api/vault', { method: 'PUT', cookie, body: { iv: IV, ciphertext: CT } }),
    );
    expect(again.status).toBe(409);
    expect(await again.json()).toEqual({ error: 'conflict', revision: 1 });
    const second = await vault.PUT(
      req('/api/vault', {
        method: 'PUT',
        cookie,
        body: { iv: IV, ciphertext: 'E'.repeat(64), baseRevision: 1 },
      }),
    );
    expect(await second.json()).toMatchObject({ revision: 2 });
    const stale = await vault.PUT(
      req('/api/vault', {
        method: 'PUT',
        cookie,
        body: { iv: IV, ciphertext: CT, baseRevision: 1 },
      }),
    );
    expect(stale.status).toBe(409);

    const got = await (await vault.GET(req('/api/vault', { cookie }))).json();
    expect(got).toMatchObject({ iv: IV, ciphertext: 'E'.repeat(64), revision: 2 });
    expect(
      (
        await vault.PUT(
          req('/api/vault', { method: 'PUT', cookie, body: { iv: 'x', ciphertext: CT } }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await vault.PUT(
          req('/api/vault', {
            method: 'PUT',
            cookie,
            body: { iv: IV, ciphertext: CT, baseRevision: -1 },
          }),
        )
      ).status,
    ).toBe(400);
  });

  it('creates, reads, updates and deletes card links', async () => {
    const cookie = await signUp();
    expect((await shares.GET(req('/api/shares', { cookie }))).status).toBe(404);
    const created = await shares.POST(
      req('/api/shares', { cookie, body: { iv: IV, ciphertext: CT } }),
    );
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as { id: string };
    expect(id).toMatch(/^[A-Za-z0-9_-]{22}$/);

    const ctx = (value: string) => ({ params: Promise.resolve({ id: value }) });
    const pub = await shareById.GET(req(`/api/shares/${id}`), ctx(id));
    expect(await pub.json()).toEqual({ iv: IV, ciphertext: CT });
    expect(pub.headers.get('x-robots-tag')).toBe('noindex');
    expect((await shareById.GET(req('/api/shares/x'), ctx('x'))).status).toBe(404);
    expect((await shareById.GET(req('/api/shares/missing'), ctx('M'.repeat(22)))).status).toBe(404);

    const kept = await shares.POST(
      req('/api/shares', { cookie, body: { iv: IV, ciphertext: 'F'.repeat(64), keepId: true } }),
    );
    expect((await kept.json()).id).toBe(id);
    const rotated = await shares.POST(
      req('/api/shares', { cookie, body: { iv: IV, ciphertext: CT } }),
    );
    expect((await rotated.json()).id).not.toBe(id);
    expect((await shares.GET(req('/api/shares', { cookie }))).status).toBe(200);
    expect((await shares.POST(req('/api/shares', { cookie, body: { iv: IV } }))).status).toBe(400);

    await shares.DELETE(req('/api/shares', { method: 'DELETE', cookie }));
    expect((await shares.GET(req('/api/shares', { cookie }))).status).toBe(404);
  });

  it('deletes the account and everything in it', async () => {
    const cookie = await signUp();
    await vault.PUT(req('/api/vault', { method: 'PUT', cookie, body: { iv: IV, ciphertext: CT } }));
    await shares.POST(req('/api/shares', { cookie, body: { iv: IV, ciphertext: CT } }));
    const res = await account.DELETE(req('/api/account', { method: 'DELETE', cookie }));
    expect(res.status).toBe(200);
    for (const table of ['users', 'sessions', 'vaults', 'shares']) {
      const { rows } = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table}`);
      expect(rows[0]!.n, table).toBe(0);
    }
  });

  it('turns accounts off without a database', async () => {
    delete process.env.DATABASE_URL;
    try {
      expect(
        (await params.POST(req('/api/auth/params', { body: { email: 'a@b.co' } }))).status,
      ).toBe(404);
      expect(await (await health.GET()).json()).toMatchObject({
        accounts: false,
        database: 'disabled',
      });
      expect(
        (await logout.POST(req('/api/auth/logout', { method: 'POST', body: {} }))).status,
      ).toBe(200);
    } finally {
      process.env.DATABASE_URL = 'postgres://pglite/test';
    }
  });
});
