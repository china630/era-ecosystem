import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getReservationFull, patchReservationFull } from '@/lib/services/reservation-full.service';
import { collectStayOperationalGaps } from '@/lib/services/stay-operational-readiness.service';
import { reservationFullPatchSchema } from '@/lib/reservation-full-patch.schema';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { prisma } from '@/lib/prisma';
import { recordHotelAudit } from '@/lib/satellite-audit';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const { id } = await params;
    return jsonOk(serialize(await getReservationFull(id)));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const { id } = await params;
    const body = reservationFullPatchSchema.parse(await request.json());
    const before = await prisma.reservation.findUnique({ where: { id } });
    const full = await patchReservationFull(id, body);
    const after = await prisma.reservation.findUnique({ where: { id } });
    if (before && after) {
      const changes = scalarDiff(
        before as unknown as Record<string, unknown>,
        after as unknown as Record<string, unknown>,
      );
      if (Object.keys(changes).length > 0) {
        await recordHotelAudit({ userId: session?.sub, request }, 'Reservation', id, 'UPDATE', {
          reservationId: id,
          fields: changes,
        });
      }
    }
    const operationalGaps = await collectStayOperationalGaps(id);
    return jsonOk(serialize({ ...full, operationalGaps }));
  } catch (err) {
    return handleRouteError(err);
  }
}

function scalarDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after)) {
    const next = after[key];
    if (next && typeof next === 'object') continue;
    const prev = before[key];
    if (prev && typeof prev === 'object' && !(prev instanceof Date)) continue;
    const prevText = prev instanceof Date ? prev.toISOString() : String(prev ?? '');
    const nextText = next instanceof Date ? next.toISOString() : String(next ?? '');
    if (prevText !== nextText) changes[key] = { from: prev ?? null, to: next ?? null };
  }
  return changes;
}
