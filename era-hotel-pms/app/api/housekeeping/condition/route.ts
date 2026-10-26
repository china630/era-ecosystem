import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { prisma } from '@/lib/prisma';
import { updateRoomAxes } from '@/lib/services/room.service';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertAnyPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { sessionHasHotelPermission } from '@/lib/auth/permission-check';
import type { RoomHkCondition, RoomInventoryStatus } from '@prisma/client';

const schema = z.object({
  roomId: z.string().uuid(),
  hkCondition: z.enum(['DIRTY', 'PICKUP', 'CLEAN', 'INSPECTED']),
});

export async function POST(request: Request) {
  try {
    const session = await getSatelliteSession();
    assertAnyPermission(session, [PERMISSIONS.HOUSEKEEPING_MANAGE, PERMISSIONS.ROOMS_STATUS]);
    const body = schema.parse(await request.json());
    const room = await prisma.room.findUnique({ where: { id: body.roomId } });
    if (!room) throw new Error('Room not found');
    const inventory: RoomInventoryStatus =
      room.inventoryStatus === 'OOO' || room.inventoryStatus === 'OOS' ? room.inventoryStatus : 'IN_SERVICE';
    const allowOccupiedHk = sessionHasHotelPermission(
      {
        login: session.login,
        email: session.email,
        role: session.role,
        permissions: session.permissions,
        isOwner: session.isOwner,
      },
      PERMISSIONS.HOUSEKEEPING_MANAGE,
    );
    const updated = await updateRoomAxes(
      body.roomId,
      body.hkCondition as RoomHkCondition,
      inventory,
      room.inventoryReason,
      { userId: session.sub, request },
      { allowOccupiedHk },
    );
    return jsonOk(serialize(updated));
  } catch (err) {
    return handleRouteError(err);
  }
}
