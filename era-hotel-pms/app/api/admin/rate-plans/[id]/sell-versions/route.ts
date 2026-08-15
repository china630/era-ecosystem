import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertMasterDataRead, assertMasterDataWrite } from '@/lib/auth/master-data-guard';
import {
  addRatePlanSellVersion,
  listRatePlanSellVersions,
} from '@/lib/services/rate-plan-sell-versions.service';

const postSchema = z.object({
  sellPrice: z.number().positive(),
  costFloor: z.number().min(0).nullable().optional(),
  occupancy: z.number().int().min(1).max(10).optional(),
  effectiveFrom: z.string().min(8),
  note: z.string().max(500).nullable().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertMasterDataRead(await getSessionFromHeaders());
    const { id } = await params;
    return jsonOk(serialize(await listRatePlanSellVersions(id)));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertMasterDataWrite(session);
    const { id } = await params;
    const body = postSchema.parse(await request.json());
    const row = await addRatePlanSellVersion({
      ratePlanId: id,
      sellPrice: body.sellPrice,
      costFloor: body.costFloor,
      occupancy: body.occupancy,
      effectiveFrom: new Date(body.effectiveFrom),
      note: body.note,
      createdById: session?.sub,
    });
    return jsonOk(serialize(row), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
