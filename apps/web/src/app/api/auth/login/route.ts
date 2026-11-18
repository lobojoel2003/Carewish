import { createSession, dummyAuthHash, findUser, verifyAuthKey } from '@/server/auth';
import { isValidEmail, normalizeEmail } from '@/lib/crypto';
import {
  HttpError,
  assertSameOrigin,
  clientKey,
  handler,
  isB64u,
  json,
  readJson,
  requireDb,
  sessionCookie,
} from '@/server/http';
import { authLimiter } from '@/server/rate-limit';

export const dynamic = 'force-dynamic';

export const POST = handler(async (request) => {
  assertSameOrigin(request);
  const db = await requireDb();
  const body = await readJson<{ email?: unknown; authKey?: unknown }>(request);
  if (
    typeof body.email !== 'string' ||
    !isValidEmail(body.email) ||
    !isB64u(body.authKey, 43, 43)
  ) {
    throw new HttpError('invalid', 400);
  }
  const email = normalizeEmail(body.email);
  if (
    !authLimiter.allow(`login:${clientKey(request)}`) ||
    !authLimiter.allow(`login-email:${email}`)
  ) {
    throw new HttpError('rate-limited', 429);
  }
  const user = await findUser(db, email);
  const ok = await verifyAuthKey(body.authKey, user?.auth_hash ?? (await dummyAuthHash()));
  if (!user || !ok) throw new HttpError('unauthorized', 401);
  const token = await createSession(db, user.id);
  return json({ email: user.email }, 200, { 'Set-Cookie': sessionCookie(request, token) });
});
