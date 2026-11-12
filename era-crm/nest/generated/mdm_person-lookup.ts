import { composePersonFullName, isValidAzFin, linkPersonIdentity, lookupGlobalPersonByFin, normalizeNationalityIso, resolveIncomingNameParts } from "@era/satellite-kit";
import { requestOrganizationId } from "@/lib/request-organization";
import { enterCrmStaff, crmNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithCrmTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/mdm/person-lookup", async (httpReq, httpRes) => {
    if (!(await enterCrmStaff(httpReq, httpRes))) return;
    try {
      const session = await crmNestSession(httpReq);
      const web = await runWithCrmTenant(session, async () => {
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

  
    if (!(session)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const body = (httpReq.body) as {
      fin?: string;
      passport?: string;
      issuingCountry?: string;
      firstName?: string;
      middleName?: string;
      lastName?: string;
      fullName?: string;
      phone?: string;
      nationality?: string;
    };
    const fin = body.fin?.trim();
    const parts = resolveIncomingNameParts(body);
    const fullName =
      composePersonFullName(parts?.firstName, parts?.middleName, parts?.lastName) ||
      body.fullName?.trim() ||
      "";
    const orgId = requestOrganizationId();

    if (fin) {
      if (!isValidAzFin(fin)) {
        return sendJson(httpRes, { error: "FIN must be 7 alphanumeric characters (no I/O)" }, 400);
      }
      const lookup = await lookupGlobalPersonByFin(fin, {
        requesterOrgId: orgId,
        purpose: "crm_lead",
      });
      if (lookup.globalPersonId) {
        return sendJson(httpRes, { globalPersonId: lookup.globalPersonId, masked: lookup.masked });
      }
    }

    if (!fullName && !(parts?.firstName?.trim() && parts?.lastName?.trim())) {
      return sendJson(httpRes, { error: "fullName or firstName+lastName required when FIN not found" }, 400);
    }

    const linked = await linkPersonIdentity(
      {
        fin: fin || undefined,
        passport: body.passport?.trim(),
        issuingCountry: body.issuingCountry?.trim() || undefined,
        firstName: parts?.firstName?.trim() || undefined,
        middleName: parts?.middleName?.trim() || undefined,
        lastName: parts?.lastName?.trim() || undefined,
        fullName: fullName || undefined,
        phone: body.phone?.trim(),
        nationality: normalizeNationalityIso(body.nationality) ?? undefined,
      },
      { requesterOrgId: orgId, purpose: "crm_lead" },
    );

    if (!linked.globalPersonId) {
      return sendJson(httpRes, { error: "Could not resolve person identity" }, 404);
    }

    return sendJson(httpRes, {
      globalPersonId: linked.globalPersonId,
      created: linked.created,
      masked: linked.masked,
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
