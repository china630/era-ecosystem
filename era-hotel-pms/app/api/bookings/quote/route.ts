import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { quoteBookingRate } from '@/lib/services/contract-pricing.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const schema = z.object({
  ratePlanId: z.string().uuid(),
  checkInDate: z.coerce.date(),
  checkOutDate: z.coerce.date(),
  agencyId: z.string().uuid().optional(),
});

export async function GET(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const params = new URL(request.url).searchParams;
    const body = schema.parse({
      ratePlanId: params.get('ratePlanId'),
      checkInDate: params.get('checkInDate'),
      checkOutDate: params.get('checkOutDate'),
      agencyId: params.get('agencyId') ?? undefined,
    });
    return jsonOk(serialize(await quoteBookingRate(body)));
  } catch (err) {
    return handleRouteError(err);
  }
}
