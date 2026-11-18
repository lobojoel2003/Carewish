import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto';
import type { Db } from './db';

export const SESSION_COOKIE = 'cw_session';
export const SESSION_DAYS = 30;
export const KDF_ITERATIONS = 600_000;

const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } satisfies ScryptOptions;

function scryptAsync(secret: string, salt: Buffer, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(secret, salt, 32, opts, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

const b64u = (b: Buffer) => b.toString('base64url');

/**
 * Hashes the client-derived auth key again on the server, so a database leak
 * does not reveal a value that can be replayed to sign in.
 */
export async function hashAuthKey(authKey: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(authKey, salt, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${b64u(salt)}$${b64u(hash)}`;
}

export async function verifyAuthKey(authKey: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !n || !r || !p || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const actual = await scryptAsync(authKey, Buffer.from(salt, 'base64url'), {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: SCRYPT.maxmem,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

let devSecret: string | undefined;

/** Server secret for deriving decoy salts. Set CAREWISH_SECRET in production. */
export function serverSecret(): string {
  const secret = process.env.CAREWISH_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.CAREWISH_ALLOW_INSECURE_SECRET !== 'true'
  ) {
    throw new Error(
      'CAREWISH_SECRET must be set to at least 32 characters when accounts are enabled.',
    );
  }
  devSecret ??= randomBytes(32).toString('hex');
  return devSecret;
}

/**
 * A stable, fake KDF salt for an email with no account, so the login
 * parameters endpoint does not reveal which emails are registered.
 */
export function decoySalt(email: string): string {
  return b64u(
    createHmac('sha256', serverSecret()).update(`salt:${email}`).digest().subarray(0, 16),
  );
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}

export interface SessionUser {
  userId: string;
  email: string;
}

export async function createSession(db: Db, userId: string, now = new Date()): Promise<string> {
  const token = b64u(randomBytes(32));
  const expires = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [
    hashToken(token),
    userId,
    expires.toISOString(),
  ]);
  // opportunistic cleanup of expired sessions
  await db.query('DELETE FROM sessions WHERE expires_at < $1', [now.toISOString()]);
  return token;
}

export async function getSessionUser(
  db: Db,
  token: string | undefined,
  now = new Date(),
): Promise<SessionUser | null> {
  if (!token || token.length > 100) return null;
  const { rows } = await db.query<{ user_id: string; email: string }>(
    `SELECT s.user_id, u.email FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > $2`,
    [hashToken(token), now.toISOString()],
  );
  const row = rows[0];
  return row ? { userId: row.user_id, email: row.email } : null;
}

export async function deleteSession(db: Db, token: string | undefined): Promise<void> {
  if (token) await db.query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
}

export interface NewUser {
  email: string;
  salt: string;
  iterations: number;
  authKey: string;
}

/** Creates a user. Returns null when the email is taken. */
export async function createUser(db: Db, user: NewUser): Promise<string | null> {
  const id = randomUUID();
  const hash = await hashAuthKey(user.authKey);
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO users (id, email, kdf_salt, kdf_iterations, auth_hash) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO NOTHING RETURNING id`,
    [id, user.email, user.salt, user.iterations, hash],
  );
  return rows[0]?.id ?? null;
}

export async function findUser(db: Db, email: string) {
  const { rows } = await db.query<{
    id: string;
    email: string;
    kdf_salt: string;
    kdf_iterations: number;
    auth_hash: string;
  }>('SELECT id, email, kdf_salt, kdf_iterations, auth_hash FROM users WHERE email = $1', [email]);
  return rows[0] ?? null;
}

/** A hash to compare against when the user doesn't exist, so timing doesn't reveal it. */
let dummyHash: Promise<string> | undefined;
export function dummyAuthHash(): Promise<string> {
  dummyHash ??= hashAuthKey('carewish-dummy');
  return dummyHash;
}
