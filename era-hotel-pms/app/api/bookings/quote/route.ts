import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { quoteReservationStay } from '@/lib/services/pricing-quote.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const schema = z.object({
  ratePlanId: z.string().uuid(),
  checkInDate: z.coerce.date(),
  checkOutDate: z.coerce.date(),
  agencyId: z.string().uuid().optional(),
  roomTypeId: z.string().uuid().optional(),
});

export async function GET(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const params = new URL(request.url).searchParams;
    const body = schema.parse({
      ratePlanId: params.get('ratePlanId'),
      checkInDate: params.get('checkInDate'),
      checkOutDate: params.get('checkOutDate'),
      agencyId: params.get('agencyId') ?? undefined,
      roomTypeId: params.get('roomTypeId') ?? undefined,
    });
    const { prisma } = await import('@/lib/prisma');
    let roomTypeId = body.roomTypeId;
    if (!roomTypeId) {
      const plan = await prisma.ratePlan.findUnique({
        where: { id: body.ratePlanId },
        select: { roomTypeId: true },
      });
      roomTypeId = plan?.roomTypeId ?? undefined;
    }
    if (!roomTypeId) {
      const rt = await prisma.roomType.findFirst({ where: { active: true }, select: { id: true } });
      roomTypeId = rt?.id;
    }
    if (!roomTypeId) throw new Error('roomTypeId required');
    return jsonOk(
      serialize(
        await quoteReservationStay({
          ...body,
          roomTypeId,
        }),
      ),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
