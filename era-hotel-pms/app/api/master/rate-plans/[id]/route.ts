import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { updateRatePlan } from '@/lib/services/master-data.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertMasterDataWrite } from '@/lib/auth/master-data-guard';

const schema = z.object({
  name: z.string().min(1).optional(),
  pricePerNight: z.number().positive().optional(),
  medicalFlag: z.boolean().optional(),
  roomTypeId: z.string().uuid().nullable().optional(),
  mealPlanId: z.string().uuid().nullable().optional(),
  active: z.boolean().optional(),
  baseOccupancy: z.number().int().min(1).max(10).optional(),
  extraAdultAmount: z.number().min(0).nullable().optional(),
  thirdAdultAmount: z.number().min(0).nullable().optional(),
  extraBedAmount: z.number().min(0).nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertMasterDataWrite(await getSessionFromHeaders());
    const { id } = await params;
    const body = schema.parse(await request.json());
    return jsonOk(serialize(await updateRatePlan(id, body)));
  } catch (err) {
    return handleRouteError(err);
  }
}
