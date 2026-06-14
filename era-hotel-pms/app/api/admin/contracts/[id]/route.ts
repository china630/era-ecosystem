import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import {
  getSalesContract,
  updateSalesContract,
  getContractUtilization,
} from '@/lib/services/sales-contract.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertMasterDataRead, assertMasterDataWrite } from '@/lib/auth/master-data-guard';
import { requireHotelModule } from '@/lib/hotel-module-gate';

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  counterpartyType: z.enum(['AGENCY', 'CORPORATE']).optional(),
  agencyId: z.string().uuid().nullable().optional(),
  companyGuestId: z.string().uuid().nullable().optional(),
  validFrom: z.coerce.date().optional(),
  validTo: z.coerce.date().nullable().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'EXPIRED', 'CANCELLED']).optional(),
  ratePlanId: z.string().uuid().optional(),
  minStay: z.number().int().positive().nullable().optional(),
  cta: z.boolean().optional(),
  ctd: z.boolean().optional(),
  commissionPercent: z.number().min(0).max(100).nullable().optional(),
  depositRequired: z.boolean().optional(),
  depositAmount: z.number().nonnegative().nullable().optional(),
  notes: z.string().nullable().optional(),
  externalRef: z.string().nullable().optional(),
});

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireHotelModule('hotel_distribution');
    assertMasterDataRead(await getSessionFromHeaders());
    const { id } = await ctx.params;
    const url = new URL(_req.url);
    if (url.searchParams.get('utilization') === '1') {
      return jsonOk(serialize(await getContractUtilization(id)));
    }
    return jsonOk(serialize(await getSalesContract(id)));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireHotelModule('hotel_distribution');
    assertMasterDataWrite(await getSessionFromHeaders());
    const { id } = await ctx.params;
    const body = updateSchema.parse(await request.json());
    const updated = await updateSalesContract(id, body);
    return jsonOk(serialize(updated));
  } catch (err) {
    return handleRouteError(err);
  }
}
