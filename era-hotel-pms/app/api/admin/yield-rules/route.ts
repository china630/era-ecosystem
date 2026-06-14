import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { prisma } from '@/lib/prisma';

const createSchema = z.object({
  propertyCode: z.string().min(1).default('DEFAULT'),
  minOccupancyPct: z.number().min(0).max(100),
  rateAdjustment: z.number(),
  active: z.boolean().optional(),
});

export async function GET() {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.MASTER_DATA_MANAGE);
    const rules = await prisma.yieldRule.findMany({
      orderBy: { minOccupancyPct: 'asc' },
    });
    return jsonOk(serialize(rules));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.MASTER_DATA_MANAGE);
    const body = createSchema.parse(await request.json());
    const rule = await prisma.yieldRule.create({
      data: {
        propertyCode: body.propertyCode,
        minOccupancyPct: body.minOccupancyPct,
        rateAdjustment: body.rateAdjustment,
        active: body.active ?? true,
      },
    });
    return jsonOk(serialize(rule), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
