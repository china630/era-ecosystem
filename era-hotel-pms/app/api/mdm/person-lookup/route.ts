import { z } from 'zod';
import { lookupGlobalPersonByFin } from '@era/satellite-kit';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const schema = z.object({
  fin: z.string().min(3).max(32),
});

/** Resolve MDM global person id from FIN/passport (SP7 guest linkage). */
export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const { fin } = schema.parse(await request.json());
    const result = await lookupGlobalPersonByFin(fin.trim());
    return jsonOk(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
