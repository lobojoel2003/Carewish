import { assertSameOrigin, clearSessionCookie, handler, json, requireUser } from '@/server/http';

export const dynamic = 'force-dynamic';

/** Deletes the account and, through cascades, its sessions, vault and card link. */
export const DELETE = handler(async (request) => {
  assertSameOrigin(request);
  const { db, user } = await requireUser(request);
  await db.query('DELETE FROM users WHERE id = $1', [user.userId]);
  return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie(request) });
});
