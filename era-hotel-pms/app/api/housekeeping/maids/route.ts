import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import {
  assignTaskHousekeeper,
  createHousekeeper,
  deactivateHousekeeper,
  listHousekeepers,
  updateHousekeeperDepartment,
} from '@/lib/services/wave-b-master.service';

export async function GET() {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    return jsonOk(serialize(await listHousekeepers()));
  } catch (err) {
    return handleRouteError(err);
  }
}

const createSchema = z.object({
  globalPersonId: z.string().uuid(),
  name: z.string().min(1),
  department: z.enum(['ROOMS', 'PUBLIC_AREA', 'LAUNDRY']).optional(),
});
const assignSchema = z.object({ taskId: z.string().uuid(), housekeeperId: z.string().uuid().nullable() });
const patchSchema = z.object({
  id: z.string().uuid(),
  department: z.enum(['ROOMS', 'PUBLIC_AREA', 'LAUNDRY']).optional(),
  active: z.literal(false).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const body = await request.json();
    if (body.taskId) {
      const parsed = assignSchema.parse(body);
      return jsonOk(serialize(await assignTaskHousekeeper(parsed.taskId, parsed.housekeeperId)));
    }
    if (body.id && (body.department != null || body.active === false)) {
      const parsed = patchSchema.parse(body);
      if (parsed.active === false) {
        return jsonOk(serialize(await deactivateHousekeeper(parsed.id)));
      }
      if (parsed.department) {
        return jsonOk(serialize(await updateHousekeeperDepartment(parsed.id, parsed.department)));
      }
    }
    const parsed = createSchema.parse(body);
    return jsonOk(serialize(await createHousekeeper(parsed)));
  } catch (err) {
    return handleRouteError(err);
  }
}
