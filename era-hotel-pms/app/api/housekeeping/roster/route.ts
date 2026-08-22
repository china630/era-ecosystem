import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { proposeRosterWeek, setRosterCell } from '@/lib/services/hk-nafta.service';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const weekStart = new URL(request.url).searchParams.get('weekStart');
    if (!weekStart) {
      const maids = await prisma.housekeeper.findMany({
        include: { tasks: true },
        orderBy: { name: 'asc' },
      });
      return jsonOk(serialize(maids));
    }
    const week = await prisma.hkRosterWeek.findFirst({
      where: { weekStart: new Date(`${weekStart}T00:00:00.000Z`) },
      include: { cells: { include: { housekeeper: true } } },
    });
    return jsonOk(serialize(week));
  } catch (err) {
    return handleRouteError(err);
  }
}

const propose = z.object({ weekStart: z.string(), action: z.literal('propose').optional() });
const cell = z.object({
  cellId: z.string().uuid(),
  kind: z.enum(['E', 'L', 'N', 'OFF', 'EG', 'CUSTOM']),
  customStart: z.string().optional(),
  customEnd: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const body = await request.json();
    if (body.cellId) {
      const data = cell.parse(body);
      return jsonOk(serialize(await setRosterCell(data.cellId, data.kind, data.customStart, data.customEnd)));
    }
    const data = propose.parse(body);
    return jsonOk(serialize(await proposeRosterWeek(data.weekStart)));
  } catch (err) {
    return handleRouteError(err);
  }
}
