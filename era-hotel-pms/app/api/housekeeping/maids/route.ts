import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import {
  assignTaskHousekeeper,
  createHousekeeper,
  listHousekeepers,
} from '@/lib/services/wave-b-master.service';

export async function GET() {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    return jsonOk(serialize(await listHousekeepers()));
  } catch (err) {
    return handleRouteError(err);
  }
}

const createSchema = z.object({ code: z.string(), name: z.string() });
const assignSchema = z.object({ taskId: z.string().uuid(), housekeeperId: z.string().uuid().nullable() });

export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const body = await request.json();
    if (body.taskId) {
      const parsed = assignSchema.parse(body);
      return jsonOk(serialize(await assignTaskHousekeeper(parsed.taskId, parsed.housekeeperId)));
    }
    const parsed = createSchema.parse(body);
    return jsonOk(serialize(await createHousekeeper(parsed)));
  } catch (err) {
    return handleRouteError(err);
  }
}
