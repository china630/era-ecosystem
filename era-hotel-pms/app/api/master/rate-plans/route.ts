import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { createRatePlan, listRatePlans } from '@/lib/services/master-data.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertMasterDataRead, assertMasterDataWrite } from '@/lib/auth/master-data-guard';

const schema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  pricePerNight: z.number().positive(),
  medicalFlag: z.boolean().optional(),
  roomTypeId: z.string().uuid().optional(),
  mealPlanId: z.string().uuid().optional(),
});

export async function GET() {
  try {
    assertMasterDataRead(await getSessionFromHeaders());
    return jsonOk(serialize(await listRatePlans()));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    assertMasterDataWrite(await getSessionFromHeaders());
    const body = schema.parse(await request.json());
    return jsonOk(serialize(await createRatePlan(body)), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
