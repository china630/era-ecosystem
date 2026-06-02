import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { createLostFound, listLostFound } from '@/lib/services/wave-b-master.service';

const schema = z.object({
  foundDate: z.coerce.date(),
  location: z.string(),
  description: z.string(),
  guestId: z.string().uuid().optional(),
});

export async function GET(req: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const guestId = new URL(req.url).searchParams.get('guestId') ?? undefined;
    return jsonOk(serialize(await listLostFound(guestId)));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const body = schema.parse(await request.json());
    return jsonOk(serialize(await createLostFound(body)));
  } catch (err) {
    return handleRouteError(err);
  }
}
