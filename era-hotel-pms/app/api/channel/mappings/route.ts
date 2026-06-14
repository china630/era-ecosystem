import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { createChannel, listChannels } from '@/lib/services/wave-b-master.service';
import { prisma } from '@/lib/prisma';

const channelSchema = z.object({ code: z.string().min(1), name: z.string().min(1) });

const roomMappingSchema = z.object({
  channelId: z.string().uuid(),
  roomTypeId: z.string().uuid(),
  otaRoomCode: z.string().min(1).optional(),
});

const rateMappingSchema = z.object({
  channelId: z.string().uuid(),
  ratePlanId: z.string().uuid(),
  otaRateCode: z.string().min(1).optional(),
});

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
    if (body.channelId && body.ratePlanId) {
      const parsed = rateMappingSchema.parse(body);
      const row = await prisma.channelRateMapping.create({
        data: {
          channelId: parsed.channelId,
          ratePlanId: parsed.ratePlanId,
          otaRateCode: parsed.otaRateCode ?? 'RATE',
        },
        include: { ratePlan: true, channel: true },
      });
      return jsonOk(serialize(row));
    }
    if (body.channelId && body.roomTypeId) {
      const parsed = roomMappingSchema.parse(body);
      const row = await prisma.channelRoomMapping.create({
        data: {
          channelId: parsed.channelId,
          roomTypeId: parsed.roomTypeId,
          otaRoomCode: parsed.otaRoomCode ?? 'ROOM',
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
