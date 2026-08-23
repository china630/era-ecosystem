import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { payFolioCharge } from '@/lib/services/tour.service';

const bodySchema = z.object({
  paymentMethod: z.enum(['CASH', 'CARD', 'BANK_TRANSFER']),
});

export async function POST(req: Request, ctx: { params: Promise<{ chargeId: string }> }) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
    await requireHotelModule('hotel_core');
    const { chargeId } = await ctx.params;
    const body = bodySchema.parse(await req.json());
    return jsonOk(serialize(await payFolioCharge(chargeId, body.paymentMethod)));
  } catch (e) {
    return handleRouteError(e);
  }
}
