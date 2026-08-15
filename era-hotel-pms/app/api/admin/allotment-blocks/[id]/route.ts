import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import {
  getAllotmentBlock,
  getAllotmentBlockPickup,
  updateAllotmentBlock,
} from '@/lib/services/allotment-block.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertMasterDataRead, assertMasterDataWrite } from '@/lib/auth/master-data-guard';
import { requireHotelModule } from '@/lib/hotel-module-gate';

const lineSchema = z.object({
  roomTypeId: z.string().uuid(),
  quantity: z.number().int().positive(),
  ratePlanId: z.string().uuid().optional().nullable(),
});

const patchSchema = z.object({
  name: z.string().optional(),
  status: z.enum(['TENTATIVE', 'DEFINITE', 'CANCELLED', 'RELEASED']).optional(),
  agencyId: z.string().uuid().nullable().optional(),
  salesContractId: z.string().uuid().nullable().optional(),
  validFrom: z.coerce.date().optional(),
  validTo: z.coerce.date().optional(),
  cutoffDate: z.coerce.date().nullable().optional(),
  notes: z.string().nullable().optional(),
  lines: z.array(lineSchema).min(1).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  try {
    await requireHotelModule('hotel_distribution');
    assertMasterDataRead(await getSessionFromHeaders());
    const { id } = await ctx.params;
    const url = new URL(req.url);
    if (url.searchParams.get('pickup') === '1') {
      const pickup = await getAllotmentBlockPickup(id);
      if (!pickup) return jsonOk({ error: 'Not found' }, 404);
      return jsonOk(serialize(pickup));
    }
    const row = await getAllotmentBlock(id);
    if (!row) return jsonOk({ error: 'Not found' }, 404);
    return jsonOk(serialize(row));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    await requireHotelModule('hotel_distribution');
    assertMasterDataWrite(await getSessionFromHeaders());
    const { id } = await ctx.params;
    const body = patchSchema.parse(await request.json());
    const row = await updateAllotmentBlock(id, body);
    return jsonOk(serialize(row));
  } catch (err) {
    return handleRouteError(err);
  }
}
