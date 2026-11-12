import { NextResponse } from 'next/server';
import { serialize } from '@/lib/serialize';
import { assertAnyPermission, assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { deleteHotelLogo, readHotelLogo, saveHotelLogo } from '@/lib/services/hotel-letterhead.service';
import { resolveCpLetterheadLocks } from '@/lib/services/cp-letterhead-locks';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/hotel/profile/logo", async (httpReq, httpRes) => {
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

  
    assertAnyPermission(session, [
      PERMISSIONS.HOTEL_PROFILE,
      PERMISSIONS.REPORTS_READ,
      PERMISSIONS.RESERVATIONS_READ,
    ]);
    const logo = await readHotelLogo();
    if (!logo) return sendJson(httpRes, { error: 'Logo not set' }, 404);
    return sendBytes(httpRes, Buffer.from(logo.buffer), { 'Content-Type': logo.mimeType, 'Cache-Control': 'no-store' });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/hotel/profile/logo", async (httpReq, httpRes) => {
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

  
    assertPermission(session, PERMISSIONS.HOTEL_PROFILE);
    const locks = await resolveCpLetterheadLocks();
    if (locks.logo) {
      return sendJson(httpRes, { error: 
        'Logo is managed on the Control Plane organization profile' }, 400);
    }
    const form = await readNestForm(httpReq);
    const file = form.get('file');
    if (!(file instanceof File)) return sendJson(httpRes, { error: 'file required' }, 400);
    const profile = await saveHotelLogo({
      buffer: Buffer.from(await file.arrayBuffer()),
      mimeType: file.type,
    });
    return sendJson(httpRes, serialize(profile), 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.delete("/api/hotel/profile/logo", async (httpReq, httpRes) => {
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

  
    assertPermission(session, PERMISSIONS.HOTEL_PROFILE);
    const locks = await resolveCpLetterheadLocks();
    if (locks.logo) {
      return sendJson(httpRes, { error: 
        'Logo is managed on the Control Plane organization profile' }, 400);
    }
    return sendJson(httpRes, serialize(await deleteHotelLogo()));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
