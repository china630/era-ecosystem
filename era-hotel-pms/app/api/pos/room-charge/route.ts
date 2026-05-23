import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { postRoomCharge } from '@/lib/services/pos.service';
import { assertPosBridgeOrPermission } from '@/lib/pos-bridge-auth';
import { PERMISSIONS } from '@/lib/auth/permissions';

const schema = z.object({
  reservationId: z.string().uuid().optional(),
  roomNumber: z.string().optional(),
  revenueCode: z.string().min(1),
  amount: z.number().positive(),
  description: z.string().min(1),
  outletCode: z.string().optional(),
  productSku: z.string().optional(),
  externalTicketId: z.string().uuid().optional(),
  ticketNumber: z.string().optional(),
  posShiftId: z.string().uuid().optional(),
  waiterCode: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    await assertPosBridgeOrPermission(request, PERMISSIONS.FOLIO_CHARGE);
    const body = schema.parse(await request.json());
    if (!body.reservationId && !body.roomNumber) {
      throw new Error('reservationId or roomNumber required');
    }

    const headerKey = request.headers.get('idempotency-key')?.trim();
    const idempotencyKey = headerKey || body.externalTicketId;

    const result = await postRoomCharge({
      reservationId: body.reservationId,
      roomNumber: body.roomNumber,
      revenueCode: body.revenueCode,
      amount: body.amount,
      description: body.description,
      outletCode: body.outletCode,
      productSku: body.productSku,
      idempotencyKey,
    });

    const charge = result.charge;
    return jsonOk(
      serialize({
        ...charge,
        reservationId: result.reservationId,
        idempotent: result.idempotent,
      }),
      result.idempotent ? 200 : 201,
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
