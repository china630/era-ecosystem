import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { createRoomChangePlan, listRoomChangePlans } from '@/lib/services/reports.service';

const createSchema = z.object({
  reservationId: z.string().uuid(),
  fromRoomId: z.string().uuid().optional(),
  toRoomId: z.string().uuid().optional(),
  effectiveAt: z.coerce.date(),
  notes: z.string().optional(),
});

export async function GET() {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.REPORTS_READ);
    return jsonOk(serialize(await listRoomChangePlans()));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const body = createSchema.parse(await request.json());
    return jsonOk(serialize(await createRoomChangePlan(body)));
  } catch (err) {
    return handleRouteError(err);
  }
}
