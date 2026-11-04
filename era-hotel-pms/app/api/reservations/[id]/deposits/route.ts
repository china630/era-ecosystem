import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listDeposits, recordDeposit } from '@/lib/services/folio-deposit.service';

const bodySchema = z.object({
  reservationGuestId: z.string().uuid(),
  amount: z.number().positive(),
  paymentMethod: z.enum(['CASH', 'CARD']),
  bankTerminalId: z.string().min(1).max(64).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.FOLIO_READ);
    const { id } = await params;
    return jsonOk(serialize(await listDeposits(id)));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
    const { id } = await params;
    const data = bodySchema.parse(await request.json());
    const row = await recordDeposit({
      reservationId: id,
      reservationGuestId: data.reservationGuestId,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      bankTerminalId: data.bankTerminalId,
      audit: { userId: session?.sub, request },
    });
    return jsonOk(serialize(row), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
