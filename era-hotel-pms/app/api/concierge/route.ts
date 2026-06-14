import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import {
  listConciergeProducts,
  listConciergeOrders,
  bookConciergeOrder,
  completeConciergeOrder,
} from '@/lib/services/concierge.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const bookSchema = z.object({
  guestId: z.string().uuid(),
  productId: z.string().uuid(),
  reservationId: z.string().uuid().optional(),
  scheduledAt: z.coerce.date().optional(),
  notes: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const guestId = new URL(request.url).searchParams.get('guestId') ?? undefined;
    const view = new URL(request.url).searchParams.get('view');
    if (view === 'orders') {
      return jsonOk(serialize(await listConciergeOrders(guestId)));
    }
    return jsonOk(serialize(await listConciergeProducts()));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const body = await request.json();
    if (body.action === 'complete') {
      return jsonOk(serialize(await completeConciergeOrder(body.orderId)));
    }
    return jsonOk(serialize(await bookConciergeOrder(bookSchema.parse(body))), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
