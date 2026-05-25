import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import {
  createTransferOrder,
  listTransferOrders,
  listVehicles,
} from '@/lib/services/transfer.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const bodySchema = z.object({
  reservationId: z.string().uuid(),
  direction: z.enum(['IN', 'OUT']),
  flightNo: z.string().optional(),
  pickupAt: z.string().datetime(),
  vehicleId: z.string().uuid().optional(),
  price: z.number().nonnegative(),
  notes: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);

    const url = new URL(req.url);
    const reservationId = url.searchParams.get('reservationId') ?? undefined;
    const status = url.searchParams.get('status') ?? undefined;
    const direction = url.searchParams.get('direction') ?? undefined;
    const fromStr = url.searchParams.get('from');
    const toStr = url.searchParams.get('to');

    const [orders, vehicles] = await Promise.all([
      listTransferOrders({
        reservationId,
        status,
        direction,
        from: fromStr ? new Date(fromStr) : undefined,
        to: toStr ? new Date(toStr) : undefined,
      }),
      listVehicles(),
    ]);

    return jsonOk(serialize({ orders, vehicles }));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const body = bodySchema.parse(await req.json());
    const created = await createTransferOrder({
      ...body,
      pickupAt: new Date(body.pickupAt),
    });
    return jsonOk(serialize(created));
  } catch (err) {
    return handleRouteError(err);
  }
}
