import { z } from 'zod';
import { jsonOk, jsonError, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { prisma } from '@/lib/prisma';

const updateSchema = z.object({
  propertyCode: z.string().min(1).optional(),
  minOccupancyPct: z.number().min(0).max(100).optional(),
  rateAdjustment: z.number().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.MASTER_DATA_MANAGE);
    const { id } = await ctx.params;
    const body = updateSchema.parse(await request.json());
    const existing = await prisma.yieldRule.findUnique({ where: { id } });
    if (!existing) return jsonError('Yield rule not found', 404);
    const rule = await prisma.yieldRule.update({
      where: { id },
      data: body,
    });
    return jsonOk(serialize(rule));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.MASTER_DATA_MANAGE);
    const { id } = await ctx.params;
    const existing = await prisma.yieldRule.findUnique({ where: { id } });
    if (!existing) return jsonError('Yield rule not found', 404);
    await prisma.yieldRule.delete({ where: { id } });
    return jsonOk({ deleted: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
