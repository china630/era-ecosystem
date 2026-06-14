import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { createRoom, listRoomsMaster } from '@/lib/services/room.service';
import { listRoomsForRack } from '@/lib/services/room-rack.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertAnyPermission, assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const createSchema = z.object({
  roomNumber: z.string().min(1),
  roomTypeId: z.string().uuid(),
  floor: z.number().int().optional(),
  description: z.string().optional(),
  viewCode: z.string().optional(),
  bedTypeCode: z.string().optional(),
  location: z.string().optional(),
  maxBed: z.number().int().optional(),
});

export async function GET(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    const scope = new URL(request.url).searchParams.get('scope');
    if (scope === 'master') {
      assertPermission(session, PERMISSIONS.MASTER_DATA_MANAGE);
      return jsonOk(serialize(await listRoomsMaster()));
    }
    assertAnyPermission(session, [
      PERMISSIONS.RESERVATIONS_READ,
      PERMISSIONS.ROOMS_STATUS,
      PERMISSIONS.HOUSEKEEPING_MANAGE,
    ]);
    const rooms = await listRoomsForRack();
    return jsonOk(serialize(rooms));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.MASTER_DATA_MANAGE);
    const body = createSchema.parse(await request.json());
    const room = await createRoom(body);
    return jsonOk(serialize(room), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
