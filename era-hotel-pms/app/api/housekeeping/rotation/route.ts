import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { rotatePairsForDate, ensureFloorPairs } from '@/lib/services/hk-nafta.service';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const date = new URL(request.url).searchParams.get('date');
    if (!date) return jsonOk(serialize(await ensureFloorPairs()));
    const rows = await prisma.hkRotationDay.findMany({
      where: { workDate: new Date(`${date}T00:00:00.000Z`) },
      include: { housekeeper: true, pair: true },
    });
    return jsonOk(serialize(rows));
  } catch (err) {
    return handleRouteError(err);
  }
}

const schema = z.object({
  date: z.string(),
  shiftKind: z.enum(['E', 'L', 'N']).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const body = schema.parse(await request.json());
    return jsonOk(serialize(await rotatePairsForDate(body.date, body.shiftKind ?? 'E')));
  } catch (err) {
    return handleRouteError(err);
  }
}
