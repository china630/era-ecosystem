import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { transferDeposit } from '@/lib/services/folio-deposit.service';

const bodySchema = z.object({
  depositId: z.string().uuid(),
  targetReservationId: z.string().uuid(),
  targetReservationGuestId: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
    const data = bodySchema.parse(await request.json());
    const row = await transferDeposit({
      ...data,
      audit: { userId: session?.sub, request },
    });
    return jsonOk(serialize(row));
  } catch (err) {
    return handleRouteError(err);
  }
}
