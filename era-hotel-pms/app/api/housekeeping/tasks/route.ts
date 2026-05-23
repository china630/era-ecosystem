import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { completeTask, listTasks } from '@/lib/services/housekeeping.service';
import { setRoomOOO } from '@/lib/services/room.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

export async function GET() {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    return jsonOk(serialize(await listTasks()));
  } catch (err) {
    return handleRouteError(err);
  }
}

const completeSchema = z.object({ taskId: z.string().uuid() });
const oooSchema = z.object({ roomId: z.string().uuid(), days: z.number().int().positive(), notes: z.string().optional() });

export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const body = await request.json();
    if (body.roomId && body.days) {
      const data = oooSchema.parse(body);
      return jsonOk(serialize(await setRoomOOO(data.roomId, data.days, data.notes)));
    }
    const data = completeSchema.parse(body);
    return jsonOk(serialize(await completeTask(data.taskId)));
  } catch (err) {
    return handleRouteError(err);
  }
}
