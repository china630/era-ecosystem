import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { linkPersonIdentity } from "@era/satellite-kit";
import { buildMdmPersonLookupBody } from "@/lib/mdm-person-lookup-body";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const schema = z
  .object({
    fin: z.string().trim().optional(),
    passport: z.string().trim().optional(),
    issuingCountry: z.string().trim().optional(),
    firstName: z.string().trim().optional(),
    middleName: z.string().trim().optional(),
    lastName: z.string().trim().optional(),
    fullName: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    nationality: z.string().trim().optional(),
  })
  .refine(
    (d) =>
      Boolean(d.fullName?.trim()) ||
      Boolean(d.firstName?.trim() && d.lastName?.trim()),
    { message: "fullName or firstName+lastName required" },
  );

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/mdm/person-lookup", async (httpReq, httpRes) => {
    if (!(await enterClinicStaff(httpReq, httpRes))) return;
    try {
      const session = await clinicNestSession(httpReq);
      const web = await runWithClinicTenant(session, async () => {
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

  
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_MDM_READ);
    if (denied) return denied;

    const parsed = schema.safeParse(httpReq.body);
    if (!parsed.success) {
      return sendJson(httpRes, { error: parsed.error.issues[0]?.message ?? "Invalid body" }, 400);
    }
    const linked = await linkPersonIdentity(buildMdmPersonLookupBody(parsed.data));
    return sendJson(httpRes, linked);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
