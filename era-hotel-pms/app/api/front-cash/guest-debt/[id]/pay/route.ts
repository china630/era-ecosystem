import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { payGuestDebt } from '@/lib/services/folio.service';

const schema = z.object({
  amount: z.number().positive(),
  paymentMethod: z.enum(['CASH', 'CARD', 'BANK_TRANSFER']),
  bankTerminalId: z.string().uuid().optional().nullable(),
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
    return jsonOk(
      serialize(
        await payGuestDebt({
          entryId: id,
          amount: body.amount,
          paymentMethod: body.paymentMethod,
          bankTerminalId: body.bankTerminalId,
          createdByUserId: session?.sub,
        }),
      ),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
