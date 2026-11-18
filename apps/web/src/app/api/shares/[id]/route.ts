import { HttpError, clientKey, handler, isB64u, json, requireDb } from '@/server/http';
import { shareReadLimiter } from '@/server/rate-limit';

export const dynamic = 'force-dynamic';

/** Public: returns an encrypted card document. Without the key in the link's fragment it is unreadable. */
export const GET = handler(
  async (request: Request, context: { params: Promise<{ id: string }> }) => {
    if (!shareReadLimiter.allow(`share-read:${clientKey(request)}`))
      throw new HttpError('rate-limited', 429);
    const { id } = await context.params;
    if (!isB64u(id, 22, 22)) throw new HttpError('not-found', 404);
    const db = await requireDb();
    const { rows } = await db.query<{ iv: string; ciphertext: string }>(
      'SELECT iv, ciphertext FROM shares WHERE id = $1',
      [id],
    );
    const row = rows[0];
    if (!row) throw new HttpError('not-found', 404);
    return json({ iv: row.iv, ciphertext: row.ciphertext }, 200, { 'X-Robots-Tag': 'noindex' });
  },
);
