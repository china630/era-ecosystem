import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import {
  listDispatchRequests,
  listDispatchVehicles,
  createDispatchRequest,
  assignDispatchRequest,
  completeDispatchRequest,
} from '@/lib/services/dispatch.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const createSchema = z.object({
  guestId: z.string().uuid().optional(),
  fromLabel: z.string().min(1),
  toLabel: z.string().min(1),
  notes: z.string().optional(),
});

export async function GET() {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const [requests, vehicles] = await Promise.all([
      listDispatchRequests(),
      listDispatchVehicles(),
    ]);
    return jsonOk(serialize({ requests, vehicles }));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const body = await request.json();
    if (body.action === 'assign') {
      return jsonOk(serialize(await assignDispatchRequest(body.id, body.vehicleId)));
    }
    if (body.action === 'complete') {
      return jsonOk(serialize(await completeDispatchRequest(body.id)));
    }
    return jsonOk(serialize(await createDispatchRequest(createSchema.parse(body))), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
