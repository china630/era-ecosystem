import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { getGuestFull, patchGuestFull } from '@/lib/services/guest-full.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const patchSchema = z
  .object({
    fullName: z.string().optional(),
    firstName: z.string().nullable().optional(),
    lastName: z.string().nullable().optional(),
    middleName: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
    sex: z.string().nullable().optional(),
    /** @deprecated use sex */
    gender: z.string().nullable().optional(),
    nationality: z.string().optional(),
    phone: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    vipType: z.string().nullable().optional(),
    birthDate: z.string().nullable().optional(),
    birthPlace: z.string().nullable().optional(),
    greyList: z.boolean().optional(),
    problematic: z.boolean().optional(),
    gdprConfirmed: z.boolean().optional(),
    smsConsent: z.boolean().optional(),
    whatsappConsent: z.boolean().optional(),
    phoneConsent: z.boolean().optional(),
    emailConsent: z.boolean().optional(),
    callBack: z.boolean().optional(),
    nationalIdFin: z.string().nullable().optional(),
    voen: z.string().nullable().optional(),
    passportNumber: z.string().nullable().optional(),
    occupation: z.string().nullable().optional(),
    registrationNumber: z.string().nullable().optional(),
    vehiclePlate: z.string().nullable().optional(),
    hotelName: z.string().nullable().optional(),
    visaType: z.string().nullable().optional(),
    visaNumber: z.string().nullable().optional(),
    visaExpiry: z.string().nullable().optional(),
    maritalStatus: z.string().nullable().optional(),
    parentFatherName: z.string().nullable().optional(),
    /** @deprecated use parentFatherName */
    fatherName: z.string().nullable().optional(),
    parentMotherName: z.string().nullable().optional(),
    /** @deprecated use parentMotherName */
    motherName: z.string().nullable().optional(),
    verificationStatus: z.string().nullable().optional(),
    marriageDate: z.string().nullable().optional(),
    bonusPercent: z.number().nullable().optional(),
    phoneVerified: z.boolean().optional(),
    emailVerified: z.boolean().optional(),
    isLocked: z.boolean().optional(),
  })
  .transform(({ gender, fatherName, motherName, ...data }) => ({
    ...data,
    sex: data.sex ?? gender,
    parentFatherName: data.parentFatherName ?? fatherName,
    parentMotherName: data.parentMotherName ?? motherName,
  }));

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/guests/:id/full", async (httpReq, httpRes) => {
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

  
    assertPermission(session, PERMISSIONS.GUESTS_READ);
    const { id } = httpReq.params;
    return sendJson(httpRes, serialize(await getGuestFull(id)));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.patch("/api/guests/:id/full", async (httpReq, httpRes) => {
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

  
    assertPermission(session, PERMISSIONS.GUESTS_WRITE);
    const { id } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);
    return sendJson(httpRes, serialize(await patchGuestFull(id, body)));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
