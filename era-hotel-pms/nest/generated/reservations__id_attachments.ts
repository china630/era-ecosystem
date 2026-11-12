import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { createReservationAttachment, listReservationAttachments } from '@/lib/services/reservation-attachments.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const postSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().optional(),
  fileSize: z.number().int().optional(),
  kind: z.enum(['PASSPORT_SCAN', 'OTHER']).optional(),
  storageKey: z.string().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/reservations/:id/attachments", async (httpReq, httpRes) => {
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

  
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const { id } = httpReq.params;
    return sendJson(httpRes, serialize(await listReservationAttachments(id)));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/reservations/:id/attachments", async (httpReq, httpRes) => {
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

  
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const { id } = httpReq.params;
    const contentType = request.headers.get('content-type') ?? '';
    if (contentType.includes('multipart/form-data')) {
      const { uploadReservationAttachmentFile } = await import(
        '@/lib/services/reservation-attachments.service'
      );
      const form = await readNestForm(httpReq);
      const file = form.get('file');
      if (!(file instanceof File)) {
        return sendJson(httpRes, { error: 'file required' }, 400);
      }
      const kindRaw = String(form.get('kind') ?? 'OTHER');
      const kind = kindRaw === 'PASSPORT_SCAN' ? 'PASSPORT_SCAN' : 'OTHER';
      const buffer = Buffer.from(await file.arrayBuffer());
      const row = await uploadReservationAttachmentFile({
        reservationId: id,
        fileName: file.name || 'attachment.bin',
        mimeType: file.type || undefined,
        buffer,
        kind,
      });
      return sendJson(httpRes, serialize(row), 201);
    }
    const body = postSchema.parse(httpReq.body);
    return sendJson(httpRes, serialize(await createReservationAttachment(id, body)));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
