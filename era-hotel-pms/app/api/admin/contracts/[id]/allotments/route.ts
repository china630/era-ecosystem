import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import {
  deleteContractAllotment,
  listContractAllotments,
  upsertContractAllotment,
} from '@/lib/services/contract-allotment.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertMasterDataRead, assertMasterDataWrite } from '@/lib/auth/master-data-guard';
import { requireHotelModule } from '@/lib/hotel-module-gate';

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  roomTypeId: z.string().uuid(),
  validFrom: z.coerce.date(),
  validTo: z.coerce.date(),
  nightlyQuota: z.number().int().positive(),
  releaseDays: z.number().int().nonnegative().optional(),
});

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireHotelModule('hotel_distribution');
    assertMasterDataRead(await getSessionFromHeaders());
    const { id } = await ctx.params;
    return jsonOk(serialize(await listContractAllotments(id)));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireHotelModule('hotel_distribution');
    assertMasterDataWrite(await getSessionFromHeaders());
    const { id } = await ctx.params;
    const body = upsertSchema.parse(await request.json());
    const row = await upsertContractAllotment({ ...body, salesContractId: id });
    return jsonOk(serialize(row), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireHotelModule('hotel_distribution');
    assertMasterDataWrite(await getSessionFromHeaders());
    const url = new URL(request.url);
    const allotmentId = url.searchParams.get('allotmentId');
    if (!allotmentId) throw new Error('allotmentId query param required');
    await deleteContractAllotment(allotmentId);
    return jsonOk({ deleted: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
