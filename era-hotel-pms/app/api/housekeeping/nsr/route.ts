import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { prisma } from '@/lib/prisma';

const schema = z.object({
  reservationId: z.string().uuid(),
  roomId: z.string().uuid(),
  date: z.string(),
});

export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const body = schema.parse(await request.json());
    const row = await prisma.hkNsrDay.create({
      data: {
        reservationId: body.reservationId,
        roomId: body.roomId,
        workDate: new Date(`${body.date}T00:00:00.000Z`),
      },
    });
    return jsonOk(serialize(row));
  } catch (err) {
    return handleRouteError(err);
  }
}
