/** @deprecated Table reservations UI lives in era-fb-pos. */
import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { createPosReservation, listPosReservations } from '@/lib/services/pos.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const schema = z.object({
  resourceId: z.string().uuid(),
  startAt: z.string(),
  endAt: z.string(),
  partySize: z.number().int().optional(),
  reservationId: z.string().uuid().optional(),
  guestName: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const url = new URL(request.url);
    const dateStr = url.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
    const from = new Date(dateStr);
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    return jsonOk(serialize(await listPosReservations(from, to)));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const body = schema.parse(await request.json());
    const row = await createPosReservation({
      resourceId: body.resourceId,
      startAt: new Date(body.startAt),
      endAt: new Date(body.endAt),
      partySize: body.partySize,
      reservationId: body.reservationId,
      guestName: body.guestName,
      notes: body.notes,
    });
    return jsonOk(serialize(row), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
