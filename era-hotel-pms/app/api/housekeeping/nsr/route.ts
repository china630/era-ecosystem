import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { prisma } from '@/lib/prisma';

const schema = z.object({
  reservationId: z.string().uuid(),
  roomId: z.string().uuid(),
  date: z.string(),
  clear: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const body = schema.parse(await request.json());
    const workDate = new Date(`${body.date}T00:00:00.000Z`);
    if (body.clear) {
      await prisma.hkNsrDay.deleteMany({
        where: { reservationId: body.reservationId, workDate },
      });
      await prisma.housekeepingTask.updateMany({
        where: { roomId: body.roomId, businessDate: workDate, visitOutcome: 'REFUSED' },
        data: { visitOutcome: null, jobType: 'OTHER' },
      });
      return jsonOk({ cleared: true });
    }
    await prisma.housekeepingTask.updateMany({
      where: { roomId: body.roomId, businessDate: workDate },
      data: { visitOutcome: 'REFUSED', jobType: 'NSR' },
    });
    const existing = await prisma.hkNsrDay.findFirst({
      where: { reservationId: body.reservationId, workDate },
    });
    if (existing) return jsonOk(serialize(existing));
    const row = await prisma.hkNsrDay.create({
      data: {
        reservationId: body.reservationId,
        roomId: body.roomId,
        workDate,
      },
    });
    return jsonOk(serialize(row));
  } catch (err) {
    return handleRouteError(err);
  }
}
