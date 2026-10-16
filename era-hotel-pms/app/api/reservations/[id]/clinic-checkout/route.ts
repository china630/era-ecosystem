import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getReservation } from '@/lib/services/reservation.service';
import { requestOrganizationId } from '@/lib/request-organization';

/** Sanatorium checkout list. A non-medical rate returns medical:false and does not call the clinic. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.RESERVATIONS_CHECKOUT);
    const { id } = await params;
    const reservation = await getReservation(id);
    const { usesMedicalPackageCompose } = await import(
      '@/lib/services/medical-package-resolve.service'
    );
    if (!usesMedicalPackageCompose(reservation.ratePlan)) return jsonOk({ medical: false });

    const base = (
      process.env.CLINIC_URL ??
      process.env.ERA_CLINIC_URL ??
      ''
    ).replace(/\/$/, '');
    const token = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim() ?? '';
    if (!base || !token) return jsonOk({ medical: true, unavailable: true, paid: [], packageSessions: [], blocksCheckout: false });

    const qs = new URLSearchParams({
      organizationId: requestOrganizationId(),
      reservationId: id,
    });
    const res = await fetch(`${base}/api/internal/v1/stay-procedures?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return jsonOk({ medical: true, unavailable: true, paid: [], packageSessions: [], blocksCheckout: false });
    }
    const body = (await res.json()) as { data?: Record<string, unknown> };
    const data = body.data ?? body;
    return jsonOk({ medical: true, unavailable: false, ...data });
  } catch (err) {
    return handleRouteError(err);
  }
}
