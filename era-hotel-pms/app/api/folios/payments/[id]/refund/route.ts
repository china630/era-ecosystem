import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { refundFolioPayment } from '@/lib/services/folio-refund.service';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const schema = z.object({
  amount: z.number().positive().optional(),
  reason: z.string().trim().min(1).max(500),
  paymentMethod: z.enum(['CASH', 'CARD']).optional(),
  bankTerminalId: z.string().min(1).max(64).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
    const { id } = await params;
    const body = schema.parse(await request.json());
    const payment = await refundFolioPayment({
      paymentId: id,
      amount: body.amount,
      reason: body.reason,
      paymentMethod: body.paymentMethod,
      bankTerminalId: body.bankTerminalId,
      createdByUserId: session?.sub,
      auditRequest: request,
    });
    return jsonOk(serialize(payment), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
