import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertMasterDataRead, assertMasterDataWrite } from '@/lib/auth/master-data-guard';
import {
  addPricingComponentVersion,
  getPricingComponent,
} from '@/lib/services/pricing-components.service';
import { recordHotelAudit } from '@/lib/satellite-audit';

const bodySchema = z.object({
  sellAmount: z.number().nonnegative().nullable().optional(),
  cogsAmount: z.number().nonnegative().nullable().optional(),
  effectiveFrom: z.string().min(8),
  note: z.string().max(500).nullable().optional(),
});

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  try {
    assertMasterDataRead(await getSessionFromHeaders());
    const { code } = await ctx.params;
    return jsonOk(serialize(await getPricingComponent(code)));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertMasterDataWrite(session);
    const { code } = await ctx.params;
    const body = bodySchema.parse(await request.json());
    if (body.sellAmount == null && body.cogsAmount == null) {
      throw new Error('Provide sellAmount and/or cogsAmount');
    }
    if (!session) throw new Error('Unauthorized');
    const version = await addPricingComponentVersion({
      code,
      sellAmount: body.sellAmount,
      cogsAmount: body.cogsAmount,
      effectiveFrom: new Date(body.effectiveFrom),
      note: body.note,
      createdById: session.sub,
    });
    await recordHotelAudit(
      { userId: session.sub, request },
      'PricingComponent',
      code,
      'VERSION_CREATE',
      version as unknown as Record<string, unknown>,
    );
    return jsonOk(serialize(version), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
