import { z } from 'zod';
import { localizedNameFields } from '@/lib/catalog-label';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { deleteRatePlan, updateRatePlan } from '@/lib/services/master-data.service';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertMasterDataWrite } from '@/lib/auth/master-data-guard';

const schema = z.object({
  name: z.string().min(1).optional(),
  ...localizedNameFields,
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
    assertMasterDataWrite(await getSatelliteSession());
    const { id } = await params;
    const body = schema.parse(await request.json());
    return jsonOk(serialize(await updateRatePlan(id, body)));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertMasterDataWrite(await getSatelliteSession());
    const { id } = await params;
    await deleteRatePlan(id);
    return jsonOk({ ok: true });
  } catch (err) {
    const inUse = err as {
      code?: string;
      reservations?: number;
      contracts?: number;
      slices?: number;
      derived?: number;
      message?: string;
    };
    if (inUse?.code === 'RATE_PLAN_IN_USE') {
      return Response.json(
        {
          error: inUse.message,
          code: 'RATE_PLAN_IN_USE',
          reservations: inUse.reservations ?? 0,
          contracts: inUse.contracts ?? 0,
          slices: inUse.slices ?? 0,
          derived: inUse.derived ?? 0,
        },
        { status: 409 },
      );
    }
    return handleRouteError(err);
  }
}
