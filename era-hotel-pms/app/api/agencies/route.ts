import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { listAgencies } from '@/lib/services/agency-ledger.service';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertAnyPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { sessionHasHotelPermission } from '@/lib/auth/permission-check';

export async function GET() {
  try {
    const session = await getSatelliteSession();
    assertAnyPermission(session, [PERMISSIONS.REPORTS_READ, PERMISSIONS.BOOKING_AGENCY_PICK]);
    const rows = await listAgencies();
    const fullLedger = sessionHasHotelPermission(
      {
        login: session!.login,
        email: session!.email,
        role: session!.role,
        permissions: session!.permissions,
        isOwner: session!.isOwner,
      },
      PERMISSIONS.REPORTS_READ,
    );
    const payload = fullLedger
      ? rows
      : rows
          .filter((row) => row.active)
          .map((row) => ({ id: row.id, code: row.code, name: row.name, active: row.active }));
    return jsonOk(serialize(payload));
  } catch (err) {
    return handleRouteError(err);
  }
}
