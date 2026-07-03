import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { payPendingCharge } from '@/lib/services/settlement-hub.service';

const schema = z.object({
  paymentMethod: z.enum(['CASH', 'CARD']),
  amount: z.number().positive().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
    const { id } = await params;
    const body = schema.parse(await request.json());
    const paid = await payPendingCharge({
      pendingId: id,
      paymentMethod: body.paymentMethod,
      amount: body.amount,
    });
    return jsonOk(serialize(paid));
  } catch (err) {
    return handleRouteError(err);
  }
}
