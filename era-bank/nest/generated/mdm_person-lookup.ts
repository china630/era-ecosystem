import { z } from "zod";
import { composePersonFullName, linkPersonIdentity, normalizeNationalityIso, resolveIncomingNameParts } from "@era/satellite-kit";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { denyUnlessAnyPermission } from "@/lib/auth/require";
import { enterBankStaff, bankNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithBankTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

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

/** Resolve MDM global person id from FIN / passport (CIF natural linkage). */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/mdm/person-lookup", async (httpReq, httpRes) => {
    if (!(await enterBankStaff(httpReq, httpRes))) return;
    try {
      const session = await bankNestSession(httpReq);
      const web = await runWithBankTenant(session, async () => {
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

  
    if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const denied = denyUnlessAnyPermission(
      session,
      [PERMISSIONS.CIF_READ, PERMISSIONS.CIF_WRITE],
    );
    if (denied) return denied;

    const parsed = schema.safeParse(httpReq.body);
    if (!parsed.success) {
      return sendJson(httpRes, { error: parsed.error.issues[0]?.message ?? "Invalid body" }, 400);
    }
    const body = parsed.data;
    const parts = resolveIncomingNameParts(body);
    const fullName =
      composePersonFullName(parts?.firstName, parts?.middleName, parts?.lastName) ||
      body.fullName?.trim() ||
      "";
    const linked = await linkPersonIdentity({
      fin: body.fin,
      passport: body.passport,
      issuingCountry: body.issuingCountry,
      firstName: parts?.firstName?.trim() || undefined,
      middleName: parts?.middleName?.trim() || undefined,
      lastName: parts?.lastName?.trim() || undefined,
      fullName: fullName || undefined,
      phone: body.phone,
      nationality: normalizeNationalityIso(body.nationality) ?? undefined,
    });
    return sendJson(httpRes, linked);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
