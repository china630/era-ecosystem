import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { getHotelProfile, upsertHotelProfile } from '@/lib/services/hotel.service';
import { assertAnyPermission, assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { resolveCpLetterheadLocks } from '@/lib/services/cp-letterhead-locks';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .nullish()
    .transform((v) => (v === undefined ? undefined : v === null || v.trim() === '' ? null : v.trim()));

const schema = z.object({
  name: z.string().min(1),
  currency: z.string().optional(),
  timezone: z.string().optional(),
  propertyCode: z.string().min(1).optional(),
  roomCapacity: z.number().int().min(0).optional(),
  bedCapacity: z.number().int().min(0).nullish(),
  printName: optionalText(200),
  address: optionalText(500),
  phone: optionalText(60),
  email: optionalText(200).refine((v) => v == null || z.string().email().safeParse(v).success, {
    message: 'Invalid email',
  }),
  website: optionalText(200),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/hotel/profile", async (httpReq, httpRes) => {
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
      PERMISSIONS.RESERVATIONS_READ,
      PERMISSIONS.HOTEL_PROFILE,
      PERMISSIONS.REPORTS_READ,
    ]);
    const profile = await getHotelProfile();
    const controlPlane = await resolveCpLetterheadLocks();
    return sendJson(httpRes, serialize({ ...(profile ?? {}), controlPlane }));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.put("/api/hotel/profile", async (httpReq, httpRes) => {
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
    const body = schema.parse(httpReq.body);
    const locks = await resolveCpLetterheadLocks();
    const next = { ...body };
    // CP-ORG-PROFILE-01: strip legal chrome fields owned by orch when Sync cache present.
    if (locks.address) next.address = undefined;
    if (locks.phone) next.phone = undefined;
    if (locks.email) next.email = undefined;
    if (locks.website) next.website = undefined;
    const profile = await upsertHotelProfile(next);
    const controlPlane = locks;
    return sendJson(httpRes, serialize({ ...(profile ?? {}), controlPlane }));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
