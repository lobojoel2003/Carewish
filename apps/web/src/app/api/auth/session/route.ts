import { handler, json, requireUser } from '@/server/http';

export const dynamic = 'force-dynamic';

export const GET = handler(async (request) => {
  const { user } = await requireUser(request);
  return json({ email: user.email });
});
