import { NextResponse } from "next/server";
import { enterRequestTenant } from "@/lib/request-organization";
import { listOpenShiftsForHub } from "@/lib/shift.service";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

function organizationIdFrom(request: Request): string {
  return (
    request.headers.get("x-era-organization-id")?.trim() ||
    new URL(request.url).searchParams.get("organizationId")?.trim() ||
    ""
  );
}

/** Hotel night audit asks which retail outlets still have an open shift. */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/internal/v1/shifts/open", async (httpReq, httpRes) => {
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

  const secret = process.env.POS_BRIDGE_SECRET?.trim();
  const header = request.headers.get("x-pos-bridge-secret")?.trim() ?? "";
  if (!secret || header !== secret) {
    return sendJson(httpRes, { error: "Unauthorized" }, 401);
  }
  const organizationId = organizationIdFrom(request);
  if (!organizationId || organizationId === "demo-org") {
    return sendJson(httpRes, { error: "organizationId required" }, 400);
  }
  try {
    enterRequestTenant(organizationId);
    const { resolveCatalogOrganizationId } = await import("@era/satellite-kit");
    const shifts = await listOpenShiftsForHub();
    const open = [];
    for (const shift of shifts) {
      const hub = await resolveCatalogOrganizationId(shift.organizationId);
      if (hub !== organizationId && shift.organizationId !== organizationId) continue;
      const outletCode = shift.register?.outlet?.code?.trim();
      if (!outletCode) continue;
      open.push({
        outletCode,
        shiftId: shift.id,
        openedAt: shift.openedAt.toISOString(),
      });
    }
    return sendJson(httpRes, { open });
  } catch (err) {
    console.error("[retail shifts/open]", err);
    return sendJson(httpRes, { error: "Open shift list failed" }, 500);
  }

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
