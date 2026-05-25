import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { listProcedureServices, listAppointments } from '@/lib/services/procedure-schedule.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

export async function GET(req: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.MEDICAL_MANAGE);

    const url = new URL(req.url);
    const reservationId = url.searchParams.get('reservationId') ?? undefined;
    const status = url.searchParams.get('status') ?? undefined;
    const fromStr = url.searchParams.get('from');
    const toStr = url.searchParams.get('to');

    const [services, appointments] = await Promise.all([
      listProcedureServices(),
      listAppointments({
        reservationId,
        status,
        from: fromStr ? new Date(fromStr) : undefined,
        to: toStr ? new Date(toStr) : undefined,
      }),
    ]);

    return jsonOk(serialize({ services, appointments }));
  } catch (err) {
    return handleRouteError(err);
  }
}
