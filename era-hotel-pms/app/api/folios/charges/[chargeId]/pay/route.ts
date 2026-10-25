import { z } from 'zod';
import { jsonOk, jsonError, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { payFolioCharge } from '@/lib/services/tour.service';
import { DESK_PAYMENT_METHODS } from '@/lib/desk-payment-methods';

const bodySchema = z.object({
  paymentMethod: z.enum(DESK_PAYMENT_METHODS),
  bankTerminalId: z.string().min(1).max(64).optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ chargeId: string }> }) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
    await requireHotelModule('hotel_core', session.organizationId);
    const { chargeId } = await ctx.params;
    const body = bodySchema.parse(await req.json());
    if (body.paymentMethod === 'DEPOSIT') {
      return jsonError('DEPOSIT_INTAKE_CLOSED', 400);
    }
    return jsonOk(
      serialize(
        await payFolioCharge(chargeId, body.paymentMethod, body.bankTerminalId, session.sub, req),
      ),
    );
  } catch (e) {
    return handleRouteError(e);
  }
}
