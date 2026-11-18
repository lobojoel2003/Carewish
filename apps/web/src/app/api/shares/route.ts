import { randomBytes } from 'node:crypto';
import {
  HttpError,
  assertSameOrigin,
  clientKey,
  handler,
  isB64u,
  json,
  readJson,
  requireUser,
} from '@/server/http';
import { writeLimiter } from '@/server/rate-limit';

export const dynamic = 'force-dynamic';

export const MAX_SHARE = 4 * 1024 * 1024;

/** The signed-in user's card link, if any. */
export const GET = handler(async (request) => {
  const { db, user } = await requireUser(request);
  const { rows } = await db.query<{ id: string; updated_at: Date | string }>(
    'SELECT id, updated_at FROM shares WHERE user_id = $1',
    [user.userId],
  );
  const row = rows[0];
  if (!row) throw new HttpError('not-found', 404);
  return json({ id: row.id, updatedAt: new Date(row.updated_at).toISOString() });
});

/** Creates or replaces the user's encrypted card document. The key never reaches the server. */
export const POST = handler(async (request) => {
  assertSameOrigin(request);
  const { db, user } = await requireUser(request);
  if (!writeLimiter.allow(`share:${user.userId}:${clientKey(request)}`))
    throw new HttpError('rate-limited', 429);
  const body = await readJson<{ iv?: unknown; ciphertext?: unknown; keepId?: unknown }>(
    request,
    MAX_SHARE + 1024,
  );
  if (!isB64u(body.iv, 16, 16) || !isB64u(body.ciphertext, 16, MAX_SHARE))
    throw new HttpError('invalid', 400);
  const id = randomBytes(16).toString('base64url');
  const { rows } = await db.query<{ id: string; updated_at: Date | string }>(
    `INSERT INTO shares (id, user_id, iv, ciphertext) VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id) DO UPDATE SET
       id = CASE WHEN $5::boolean THEN shares.id ELSE EXCLUDED.id END,
       iv = EXCLUDED.iv, ciphertext = EXCLUDED.ciphertext, updated_at = now()
     RETURNING id, updated_at`,
    [id, user.userId, body.iv, body.ciphertext, body.keepId === true],
  );
  const row = rows[0]!;
  return json({ id: row.id, updatedAt: new Date(row.updated_at).toISOString() }, 201);
});

export const DELETE = handler(async (request) => {
  assertSameOrigin(request);
  const { db, user } = await requireUser(request);
  await db.query('DELETE FROM shares WHERE user_id = $1', [user.userId]);
  return json({ ok: true });
});
