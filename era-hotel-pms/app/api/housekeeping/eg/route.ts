import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { accrueEgForDate } from '@/lib/services/hk-nafta.service';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const maids = await prisma.housekeeper.findMany({
      select: { id: true, name: true, egBalance: true, department: true },
      orderBy: { name: 'asc' },
    });
    return jsonOk(serialize(maids));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const body = (await request.json()) as { date?: string };
    const date = body.date ?? new Date().toISOString().slice(0, 10);
    return jsonOk(serialize(await accrueEgForDate(date)));
  } catch (err) {
    return handleRouteError(err);
  }
}
