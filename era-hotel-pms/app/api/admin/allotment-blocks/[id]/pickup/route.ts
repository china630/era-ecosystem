import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { pickupAllotmentBlock } from '@/lib/services/allotment-block-pickup.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertMasterDataWrite } from '@/lib/auth/master-data-guard';
import { requireHotelModule } from '@/lib/hotel-module-gate';

const schema = z.object({
  bookingCode: z.string().min(1).max(32),
  bookingName: z.string().optional(),
  guestId: z.string().uuid(),
  folioMode: z.enum(['INDIVIDUAL', 'MASTER', 'SPLIT']).optional(),
  paymentMethod: z.enum(['CASH', 'CARD', 'COMPANY_ACCOUNT', 'LOYALTY_POINTS']).optional(),
  quantities: z.record(z.string().uuid(), z.number().int().nonnegative()).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    await requireHotelModule('hotel_distribution');
    assertMasterDataWrite(await getSessionFromHeaders());
    const { id } = await ctx.params;
    const body = schema.parse(await request.json());
    const result = await pickupAllotmentBlock({ allotmentBlockId: id, ...body });
    return jsonOk(serialize(result), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
