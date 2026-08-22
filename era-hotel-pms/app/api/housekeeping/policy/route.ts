import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getHkHotelPolicy, saveHkHotelPolicy } from '@/lib/services/hk-nafta.service';

export async function GET() {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    return jsonOk(serialize(await getHkHotelPolicy()));
  } catch (err) {
    return handleRouteError(err);
  }
}

const schema = z.object({
  linenEveryNights: z.number().int().min(1).max(30),
  deepEveryNights: z.number().int().min(1).max(30),
});

export async function PUT(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const body = schema.parse(await request.json());
    return jsonOk(serialize(await saveHkHotelPolicy(body.linenEveryNights, body.deepEveryNights)));
  } catch (err) {
    return handleRouteError(err);
  }
}
