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

const MAX_VAULT = 512 * 1024;

export const GET = handler(async (request) => {
  const { db, user } = await requireUser(request);
  const { rows } = await db.query<{
    iv: string;
    ciphertext: string;
    revision: number;
    updated_at: Date | string;
  }>('SELECT iv, ciphertext, revision, updated_at FROM vaults WHERE user_id = $1', [user.userId]);
  const row = rows[0];
  if (!row) throw new HttpError('not-found', 404);
  return json({
    iv: row.iv,
    ciphertext: row.ciphertext,
    revision: row.revision,
    updatedAt: new Date(row.updated_at).toISOString(),
  });
});

/**
 * Stores the encrypted vault. `baseRevision` is the revision the client last
 * saw; a mismatch returns 409 so the client can reconcile instead of
 * silently overwriting changes made on another device.
 */
export const PUT = handler(async (request) => {
  assertSameOrigin(request);
  const { db, user } = await requireUser(request);
  if (!writeLimiter.allow(`vault:${user.userId}:${clientKey(request)}`))
    throw new HttpError('rate-limited', 429);
  const body = await readJson<{ iv?: unknown; ciphertext?: unknown; baseRevision?: unknown }>(
    request,
    MAX_VAULT + 1024,
  );
  if (!isB64u(body.iv, 16, 16) || !isB64u(body.ciphertext, 16, MAX_VAULT))
    throw new HttpError('invalid', 400);
  const base =
    body.baseRevision === null || body.baseRevision === undefined ? 0 : body.baseRevision;
  if (typeof base !== 'number' || !Number.isInteger(base) || base < 0)
    throw new HttpError('invalid', 400);

  const result =
    base === 0
      ? await db.query<{ revision: number; updated_at: Date | string }>(
          `INSERT INTO vaults (user_id, iv, ciphertext) VALUES ($1, $2, $3)
           ON CONFLICT (user_id) DO NOTHING RETURNING revision, updated_at`,
          [user.userId, body.iv, body.ciphertext],
        )
      : await db.query<{ revision: number; updated_at: Date | string }>(
          `UPDATE vaults SET iv = $2, ciphertext = $3, revision = revision + 1, updated_at = now()
           WHERE user_id = $1 AND revision = $4 RETURNING revision, updated_at`,
          [user.userId, body.iv, body.ciphertext, base],
        );
  const row = result.rows[0];
  if (!row) {
    const current = await db.query<{ revision: number }>(
      'SELECT revision FROM vaults WHERE user_id = $1',
      [user.userId],
    );
    return json({ error: 'conflict', revision: current.rows[0]?.revision ?? 0 }, 409);
  }
  return json({ revision: row.revision, updatedAt: new Date(row.updated_at).toISOString() });
});
