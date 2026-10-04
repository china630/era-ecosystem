import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import {
  listConciergeProducts,
  listConciergeOrders,
  bookConciergeOrder,
  completeConciergeOrder,
  createConciergeProduct,
} from '@/lib/services/concierge.service';
import { assertActiveHotelLookupCode } from '@/lib/services/master-data.service';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const bookSchema = z.object({
  guestId: z.string().uuid(),
  productId: z.string().uuid(),
  reservationId: z.string().uuid().optional(),
  scheduledAt: z.coerce.date().optional(),
  notes: z.string().optional(),
});

const createProductSchema = z.object({
  action: z.literal('createProduct'),
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1),
  price: z.number().nonnegative(),
  supplierName: z.string().trim().max(200).optional(),
  commissionPct: z.number().min(0).max(100).optional(),
});

export async function GET(request: Request) {
  try {
    const session = await getSatelliteSession();
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
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const body = await request.json();
    if (body.action === 'complete') {
      return jsonOk(serialize(await completeConciergeOrder(body.orderId)));
    }
    if (body.action === 'createProduct') {
      const { action: _action, ...input } = createProductSchema.parse(body);
      await assertActiveHotelLookupCode('CONCIERGE_CATEGORY', input.category);
      return jsonOk(
        serialize(
          await createConciergeProduct({
            ...input,
            code: input.code.toUpperCase(),
            supplierName: input.supplierName || undefined,
          }),
        ),
        201,
      );
    }
    return jsonOk(serialize(await bookConciergeOrder(bookSchema.parse(body))), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
