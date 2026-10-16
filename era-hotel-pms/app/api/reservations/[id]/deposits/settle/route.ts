import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import {
  carryDepositRemainder,
  payoutDepositRemainder,
} from '@/lib/services/folio-deposit.service';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const bodySchema = z.object({
  depositId: z.string().uuid(),
  action: z.enum(['payout', 'carry']),
  paymentMethod: z.enum(['CASH', 'CARD']).optional(),
  bankTerminalId: z.string().min(1).max(64).optional(),
});

export async function POST(
  request: Request,
  _ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
    const body = bodySchema.parse(await request.json());
    const audit = { userId: session?.sub, request };
    if (body.action === 'carry') {
      return jsonOk(serialize(await carryDepositRemainder(body.depositId, audit)));
    }
    if (!body.paymentMethod) {
      throw new Error('Payout needs cash or card');
    }
    return jsonOk(
      serialize(
        await payoutDepositRemainder(
          body.depositId,
          body.paymentMethod,
          body.bankTerminalId,
          audit,
        ),
      ),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
