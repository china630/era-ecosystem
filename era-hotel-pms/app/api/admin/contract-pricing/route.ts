import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import {
  createContractPricingRule,
  listContractPricingRules,
} from '@/lib/services/contract-pricing.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertMasterDataRead, assertMasterDataWrite } from '@/lib/auth/master-data-guard';

const createSchema = z.object({
  name: z.string().min(1),
  agencyId: z.string().uuid().optional(),
  ratePlanId: z.string().uuid(),
  ruleType: z.enum(['DISCOUNT', 'SUPPLEMENT']),
  valuePercent: z.number().positive().max(100),
  validFrom: z.coerce.date(),
  validTo: z.coerce.date().optional(),
  active: z.boolean().optional(),
});

export async function GET() {
  try {
    assertMasterDataRead(await getSessionFromHeaders());
    return jsonOk(serialize(await listContractPricingRules()));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    assertMasterDataWrite(await getSessionFromHeaders());
    const body = createSchema.parse(await request.json());
    const created = await createContractPricingRule(body);
    return jsonOk(serialize(created), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
