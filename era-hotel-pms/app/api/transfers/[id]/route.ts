import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { assignVehicle, completeTransfer } from '@/lib/services/transfer.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const patchSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('assign'),
    vehicleId: z.string().uuid(),
  }),
  z.object({
    action: z.literal('complete'),
  }),
]);

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const { id } = await params;
    const body = patchSchema.parse(await req.json());

    const result =
      body.action === 'assign'
        ? await assignVehicle(id, body.vehicleId)
        : await completeTransfer(id);

    return jsonOk(serialize(result));
  } catch (err) {
    return handleRouteError(err);
  }
}
