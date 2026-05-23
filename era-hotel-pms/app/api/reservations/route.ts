import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { createReservation, listReservations } from '@/lib/services/reservation.service';
import type { ReservationStatus } from '@prisma/client';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const createSchema = z.object({
  roomTypeId: z.string().uuid(),
  guestId: z.string().uuid(),
  ratePlanId: z.string().uuid(),
  mealPlanId: z.string().uuid().optional(),
  roomId: z.string().uuid().optional(),
  sourceId: z.string().uuid().optional(),
  checkInDate: z.coerce.date(),
  checkOutDate: z.coerce.date(),
  paymentMethod: z.enum(['CASH', 'CARD', 'COMPANY_ACCOUNT']),
});

export async function GET(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const status = new URL(request.url).searchParams.get('status') as ReservationStatus | null;
    const reservations = await listReservations(status ?? undefined);
    return jsonOk(serialize(reservations));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const body = createSchema.parse(await request.json());
    const reservation = await createReservation(body);
    return jsonOk(serialize(reservation), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
