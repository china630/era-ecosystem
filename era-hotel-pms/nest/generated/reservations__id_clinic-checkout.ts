import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getReservation } from '@/lib/services/reservation.service';
import { requestOrganizationId } from '@/lib/request-organization';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

/** Sanatorium checkout list. A non-medical rate returns medical:false and does not call the clinic. */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/reservations/:id/clinic-checkout", async (httpReq, httpRes) => {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    assertPermission(session, PERMISSIONS.RESERVATIONS_CHECKOUT);
    const { id } = httpReq.params;
    const reservation = await getReservation(id);
    const { usesMedicalPackageCompose } = await import(
      '@/lib/services/medical-package-resolve.service'
    );
    if (!usesMedicalPackageCompose(reservation.ratePlan)) return sendJson(httpRes, { medical: false });

    const base = (
      process.env.CLINIC_URL ??
      process.env.ERA_CLINIC_URL ??
      ''
    ).replace(/\/$/, '');
    const token = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim() ?? '';
    if (!base || !token) return sendJson(httpRes, { medical: true, unavailable: true, paid: [], packageSessions: [], blocksCheckout: false });

    const qs = new URLSearchParams({
      organizationId: requestOrganizationId(),
      reservationId: id,
    });
    const res = await fetch(`${base}/api/internal/v1/stay-procedures?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return sendJson(httpRes, { medical: true, unavailable: true, paid: [], packageSessions: [], blocksCheckout: false });
    }
    const body = (httpReq.body) as { data?: Record<string, unknown> };
    const data = body.data ?? body;
    return sendJson(httpRes, { medical: true, unavailable: false, ...data });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
