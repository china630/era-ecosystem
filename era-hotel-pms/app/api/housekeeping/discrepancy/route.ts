import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { recordDiscrepancy, escalateVisitFlags } from '@/lib/services/hk-nafta.service';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const date = new URL(request.url).searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
    const rows = await prisma.hkDiscrepancy.findMany({
      where: { workDate: new Date(`${date}T00:00:00.000Z`) },
      orderBy: { createdAt: 'desc' },
    });
    const escalations = await escalateVisitFlags(date);
    return jsonOk(serialize({ rows, escalations }));
  } catch (err) {
    return handleRouteError(err);
  }
}

const schema = z.object({
  roomId: z.string().uuid(),
  date: z.string(),
  kind: z.enum(['SKIP', 'SLEEP']),
  notes: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const body = schema.parse(await request.json());
    return jsonOk(serialize(await recordDiscrepancy(body.roomId, body.date, body.kind, body.notes)));
  } catch (err) {
    return handleRouteError(err);
  }
}
