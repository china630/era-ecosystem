import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { checkInReservation } from '@/lib/services/reservation.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z
  .object({ early: z.boolean().optional(), checkInTime: z.string().optional() })
  .optional();

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/reservations/:id/check-in", async (httpReq, httpRes) => {
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

  
    assertPermission(session, PERMISSIONS.RESERVATIONS_CHECKIN);
    const { id } = httpReq.params;
    const raw = (httpReq.body ?? {});
    const body = bodySchema.parse(raw ?? {});
    const reservation = await checkInReservation(id, {
      early: body?.early === true,
      checkInTime: body?.checkInTime,
      audit: { userId: session?.sub, request },
    });
    let guestQrToken: string | null = null;
    const { usesMedicalPackageCompose } = await import(
      '@/lib/services/medical-package-resolve.service'
    );
    if (
      usesMedicalPackageCompose(reservation.ratePlan) &&
      reservation.guest?.globalPersonId
    ) {
      try {
        const { issueGuestQrToken } = await import('@era/satellite-kit');
        const qr = await issueGuestQrToken(reservation.guest.globalPersonId);
        guestQrToken = qr?.token ?? null;
      } catch {
        guestQrToken = null;
      }
    }
    return sendJson(httpRes, { ...serialize(reservation), guestQrToken });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
