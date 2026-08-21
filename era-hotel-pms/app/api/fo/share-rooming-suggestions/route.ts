import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { suggestShareDoors } from '@/lib/services/share-assignment.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const querySchema = z.object({
  reservationId: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

/** Suggest compatible share doors for an unassigned share-eligible stay. */
export async function GET(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const url = new URL(request.url);
    const parsed = querySchema.parse({
      reservationId: url.searchParams.get('reservationId'),
      limit: url.searchParams.get('limit') ?? undefined,
    });
    const suggestions = await suggestShareDoors(parsed);
    return jsonOk(serialize(suggestions));
  } catch (err) {
    return handleRouteError(err);
  }
}
