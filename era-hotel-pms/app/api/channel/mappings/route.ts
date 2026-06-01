import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { createChannel, listChannels } from '@/lib/services/wave-b-master.service';
import { prisma } from '@/lib/prisma';

const channelSchema = z.object({ code: z.string(), name: z.string() });

export async function GET() {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.CHANNEL_MANAGE);
    return jsonOk(serialize(await listChannels()));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.CHANNEL_MANAGE);
    const body = await request.json();
    if (body.channelId && body.roomTypeId) {
      const row = await prisma.channelRoomMapping.create({
        data: {
          channelId: body.channelId,
          roomTypeId: body.roomTypeId,
          otaRoomCode: body.otaRoomCode ?? 'ROOM',
        },
        include: { roomType: true, channel: true },
      });
      return jsonOk(serialize(row));
    }
    const parsed = channelSchema.parse(body);
    return jsonOk(serialize(await createChannel(parsed)));
  } catch (err) {
    return handleRouteError(err);
  }
}
