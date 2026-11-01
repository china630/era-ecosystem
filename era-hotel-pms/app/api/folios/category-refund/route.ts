import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { PAYMENT_CATEGORIES } from '@/lib/payment-category';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const schema = z.object({
  reservationId: z.string().uuid(),
  paymentCategory: z.enum(PAYMENT_CATEGORIES),
  amount: z.number().positive(),
  reason: z.string().trim().min(1).max(500),
  paymentMethod: z.enum(['CASH', 'CARD']).optional(),
  bankTerminalId: z.string().min(1).max(64).optional(),
  folioType: z.enum(['GUEST', 'AGENCY', 'COMPANY']).optional(),
  reservationGuestId: z.string().uuid().optional(),
});

/** Mid-stay return of unused credit in one cashier category on one pocket. */
export async function POST(request: Request) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
    const body = schema.parse(await request.json());
    const { refundStayCategoryCredit } = await import('@/lib/services/booking-folio.service');
    const rows = await refundStayCategoryCredit({
      reservationId: body.reservationId,
      paymentCategory: body.paymentCategory,
      amount: body.amount,
      reason: body.reason,
      paymentMethod: body.paymentMethod,
      bankTerminalId: body.bankTerminalId,
      folioType: body.folioType,
      reservationGuestId: body.reservationGuestId,
      createdByUserId: session?.sub,
      auditRequest: request,
    });
    return jsonOk(serialize(rows), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
