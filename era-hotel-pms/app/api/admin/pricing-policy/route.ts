import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import {
  getHotelPolicy,
  updateHotelPolicy,
} from '@/lib/services/hotel-policy.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertMasterDataRead, assertMasterDataWrite } from '@/lib/auth/master-data-guard';
import { recordHotelAudit } from '@/lib/satellite-audit';

const patchSchema = z.object({
  occupancyPricingEnabled: z.boolean().optional(),
  loadBasedPricingEnabled: z.boolean().optional(),
  childAbsolutePricingEnabled: z.boolean().optional(),
  standardCheckInTime: z.string().optional(),
  standardCheckOutTime: z.string().optional(),
  earlyCheckInFeeMode: z.enum(['FIXED', 'PERCENT_OF_NIGHT', 'HOURLY']).optional(),
  earlyCheckInFeeAmount: z.number().optional(),
  lateCheckOutFeeMode: z.enum(['FIXED', 'PERCENT_OF_NIGHT', 'HOURLY']).optional(),
  lateCheckOutFeeAmount: z.number().optional(),
  cityLedgerMissingCounterparty: z
    .enum(['BLOCK_CHECKOUT', 'DEFER_HANDOFF', 'AUTO_CREATE'])
    .optional(),
  yearEndBlockIfOpenCityLedger: z.boolean().optional(),
  agencyPortalAutoConfirm: z.boolean().optional(),
  agencyPortalOptionHoldHours: z.number().int().min(1).max(720).optional(),
});

export async function GET() {
  try {
    assertMasterDataRead(await getSessionFromHeaders());
    return jsonOk(await getHotelPolicy());
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertMasterDataWrite(session);
    const body = patchSchema.parse(await request.json());
    const before = await getHotelPolicy();
    const after = await updateHotelPolicy(body);
    await recordHotelAudit(
      { userId: session?.sub, request },
      'HotelPolicy',
      'pricing',
      'UPDATE',
      { before, after },
    );
    return jsonOk(after);
  } catch (err) {
    return handleRouteError(err);
  }
}
