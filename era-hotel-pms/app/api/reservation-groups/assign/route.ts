import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { prisma } from '@/lib/prisma';

const schema = z.object({
  reservationId: z.string().uuid(),
  groupId: z.string().uuid().nullable(),
});

export async function PATCH(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const body = schema.parse(await request.json());
    const updated = await prisma.reservation.update({
      where: { id: body.reservationId },
      data: { groupId: body.groupId },
    });
    return jsonOk(serialize(updated));
  } catch (err) {
    return handleRouteError(err);
  }
}
