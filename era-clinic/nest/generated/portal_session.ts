import { NextResponse } from "next/server";
import { IndustryModuleInactiveError, requireSatelliteModule, satelliteOrganizationId, verifyGuestIdentityToken, verifyGuestQrToken } from "@era/satellite-kit";
import { recordClinicAudit } from "@/lib/satellite-audit";
import { findPatientRefsByGlobalPersonId, listPublishedPortalLabResults } from "@/domain/portal/portal-session.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

async function resolvePortalIdentity(token: string) {
  const viaOrchestrator = await verifyGuestQrToken(token);
  if (viaOrchestrator?.globalPersonId) {
    if (viaOrchestrator.expiresAt < Math.floor(Date.now() / 1000)) {
      return { error: "token expired" as const, status: 410 as const };
    }
    return { identity: viaOrchestrator };
  }

  const local = verifyGuestIdentityToken(token);
  if (local?.globalPersonId) {
    if (local.expiresAt && local.expiresAt < Math.floor(Date.now() / 1000)) {
      return { error: "token expired" as const, status: 410 as const };
    }
    return { identity: local };
  }

  return { error: "invalid or expired token" as const, status: 401 as const };
}

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/portal/session", async (httpReq, httpRes) => {
    try {
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

  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim();
  if (!token || token.length < 16) {
    return sendJson(httpRes, { error: "token required" }, 400);
  }

  const resolved = await resolvePortalIdentity(token);
  if ("error" in resolved) {
    return sendJson(httpRes, { error: resolved.error }, ( { status: resolved.status }).status ?? 200);
  }

  const { identity } = resolved;
  const patients = await findPatientRefsByGlobalPersonId(identity.globalPersonId);
  const orgIds = [
    ...new Set(patients.map((p) => p.organizationId?.trim()).filter((id): id is string => Boolean(id))),
  ];
  if (orgIds.length === 0) {
    try {
      const bound = satelliteOrganizationId();
      if (bound) orgIds.push(bound);
    } catch {
      /* SHARED without a bind — fail closed below */
    }
  }
  const entitledOrgs: string[] = [];
  for (const organizationId of orgIds) {
    try {
      await requireSatelliteModule("platform_portal", { organizationId });
      entitledOrgs.push(organizationId);
    } catch (err) {
      if (!(err instanceof IndustryModuleInactiveError)) throw err;
    }
  }
  if (entitledOrgs.length === 0) {
    return sendJson(httpRes, { error: "portal_module_inactive" }, 403);
  }
  const entitled = new Set(entitledOrgs);
  const patientIds = patients
    .filter((p) => entitled.has(p.organizationId))
    .map((p) => p.id);
  if (patientIds.length === 0) {
    return sendJson(httpRes, {
      globalPersonId: identity.globalPersonId,
      expiresAt: identity.expiresAt,
      labResults: [],
    });
  }

  const labResults = await listPublishedPortalLabResults(patientIds);

  await recordClinicAudit(
    { request },
    "portal",
    identity.globalPersonId,
    "PORTAL_ACCESS",
    { labCount: labResults.length },
  );

  return sendJson(httpRes, {
    globalPersonId: identity.globalPersonId,
    expiresAt: identity.expiresAt,
    labResults,
  });

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
