import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import {
  createStopSell,
  listStopSells,
  removeStopSell,
} from '@/lib/services/channel.service';

const createSchema = z.object({
  date: z.string().min(1),
  roomTypeId: z.string().uuid().optional(),
  note: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.CHANNEL_MANAGE);
    const url = new URL(request.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const list = await listStopSells(
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
    return jsonOk(serialize(list));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.CHANNEL_MANAGE);
    const body = createSchema.parse(await request.json());
    const row = await createStopSell({
      date: new Date(body.date),
      roomTypeId: body.roomTypeId,
      note: body.note,
    });
    return jsonOk(serialize(row), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.CHANNEL_MANAGE);
    const id = new URL(request.url).searchParams.get('id');
    if (!id) throw new Error('id query param required');
    await removeStopSell(id);
    return jsonOk({ deleted: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
