import { deleteSession } from '@/server/auth';
import { accountsEnabled, getDb } from '@/server/db';
import { assertSameOrigin, clearSessionCookie, handler, json, sessionToken } from '@/server/http';

export const dynamic = 'force-dynamic';

export const POST = handler(async (request) => {
  assertSameOrigin(request);
  if (accountsEnabled()) await deleteSession(await getDb(), sessionToken(request));
  return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie(request) });
});
