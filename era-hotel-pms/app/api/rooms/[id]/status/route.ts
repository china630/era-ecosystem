import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { prisma } from '@/lib/prisma';
import { updateRoomAxes, updateRoomStatus } from '@/lib/services/room.service';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import type { RoomHkCondition, RoomStatus } from '@prisma/client';

const schema = z.object({
  status: z
    .enum([
      'AVAILABLE',
      'OCCUPIED',
      'DIRTY',
      'CLEAN',
      'INSPECTED',
      'OOO',
      'OOS',
      'MAINTENANCE',
      'PICKUP',
    ])
    .optional(),
  hkCondition: z.enum(['DIRTY', 'PICKUP', 'CLEAN', 'INSPECTED']).optional(),
  inventoryStatus: z.enum(['IN_SERVICE', 'OOS', 'OOO']).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.ROOMS_STATUS);
    const { id } = await params;
    const body = schema.parse(await request.json());
    if (body.hkCondition || body.inventoryStatus) {
      const fromStatus =
        body.status === 'INSPECTED' ||
        body.status === 'DIRTY' ||
        body.status === 'PICKUP' ||
        body.status === 'CLEAN'
          ? (body.status as RoomHkCondition)
          : null;
      const current = await prisma.room.findUnique({
        where: { id },
        select: { hkCondition: true },
      });
      if (!current) throw new Error('Room not found');
      const hk = (body.hkCondition ?? fromStatus ?? current.hkCondition) as RoomHkCondition;
      const inv =
        body.inventoryStatus ??
        (body.status === 'OOO' ? 'OOO' : body.status === 'OOS' || body.status === 'MAINTENANCE' ? 'OOS' : 'IN_SERVICE');
      const room = await updateRoomAxes(id, hk, inv, null, { userId: session?.sub, request });
      return jsonOk(serialize(room));
    }
    if (!body.status || body.status === 'PICKUP') {
      const room = await updateRoomAxes(id, 'PICKUP', 'IN_SERVICE', null, { userId: session?.sub, request });
      return jsonOk(serialize(room));
    }
    const room = await updateRoomStatus(id, body.status as RoomStatus, { userId: session?.sub, request });
    return jsonOk(serialize(room));
  } catch (err) {
    return handleRouteError(err);
  }
}
