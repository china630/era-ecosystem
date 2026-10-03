import { prisma } from '@/lib/prisma';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { ensureFoBookingSources } from '@/lib/services/booking-source.service';

export async function GET() {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    try {
      await ensureFoBookingSources(session.organizationId);
    } catch {
      /* list still returns existing rows */
    }
    const rows = await prisma.bookingSource.findMany({
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true },
    });
    return jsonOk(rows);
  } catch (err) {
    return handleRouteError(err);
  }
}
