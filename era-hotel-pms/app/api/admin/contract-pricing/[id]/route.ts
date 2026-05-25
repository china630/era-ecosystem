import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import {
  deleteContractPricingRule,
  updateContractPricingRule,
} from '@/lib/services/contract-pricing.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertMasterDataWrite } from '@/lib/auth/master-data-guard';

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  agencyId: z.string().uuid().nullable().optional(),
  ratePlanId: z.string().uuid().optional(),
  ruleType: z.enum(['DISCOUNT', 'SUPPLEMENT']).optional(),
  valuePercent: z.number().positive().max(100).optional(),
  validFrom: z.coerce.date().optional(),
  validTo: z.coerce.date().nullable().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertMasterDataWrite(await getSessionFromHeaders());
    const { id } = await params;
    const body = patchSchema.parse(await request.json());
    const updated = await updateContractPricingRule(id, body);
    return jsonOk(serialize(updated));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertMasterDataWrite(await getSessionFromHeaders());
    const { id } = await params;
    await deleteContractPricingRule(id);
    return jsonOk({ deleted: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
