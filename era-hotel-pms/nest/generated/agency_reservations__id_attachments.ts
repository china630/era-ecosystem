import { serialize } from '@/lib/serialize';
import { requireAgencyPortalSession } from '@/lib/auth/agency-session';
import { findAgencyOwnedReservation } from '@/lib/services/agency-portal.service';
import { uploadReservationAttachmentFile } from '@/lib/services/reservation-attachments.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

/**
 * Agency uploads optional passport scan for own reservation.
 * multipart: file + optional kind=PASSPORT_SCAN
 */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/agency/reservations/:id/attachments", async (httpReq, httpRes) => {
    try {
    if (rejectMissingAgency(httpReq, httpRes)) return;
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    const session = await requireAgencyPortalSession();
    const { id } = httpReq.params;
    const reservation = await findAgencyOwnedReservation(session.agencyId, id);
    if (!reservation) {
      return sendJson(httpRes, { error: 'Reservation not found' }, 404);
    }

    const form = await readNestForm(httpReq);
    const file = form.get('file');
    if (!(file instanceof File)) {
      return sendJson(httpRes, { error: 'file required' }, 400);
    }
    const kindRaw = String(form.get('kind') ?? 'PASSPORT_SCAN');
    const kind = kindRaw === 'OTHER' ? 'OTHER' : 'PASSPORT_SCAN';
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > 8 * 1024 * 1024) {
      return sendJson(httpRes, { error: 'File too large (max 8MB)' }, 400);
    }
    const row = await uploadReservationAttachmentFile({
      reservationId: id,
      fileName: file.name || 'passport.bin',
      mimeType: file.type || undefined,
      buffer,
      kind,
    });
    return sendJson(httpRes, serialize(row), 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
