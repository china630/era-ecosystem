import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { payPendingBasket } from '@/lib/services/settlement-hub.service';

const schema = z.object({
  basketRef: z.string().min(1).max(64),
  paymentMethod: z.enum(['CASH', 'CARD']),
});

export async function POST(request: Request) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
    const body = schema.parse(await request.json());
    const paid = await payPendingBasket(body);
    return jsonOk(paid);
  } catch (err) {
    return handleRouteError(err);
  }
}
