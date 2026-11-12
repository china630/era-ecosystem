import { NextResponse } from "next/server";
import { handleStaffProvisionEvent, SatelliteLoginTakenError, SatelliteTargetAmbiguousError } from "@/lib/staff-provision";
import { enterRequestTenant } from "@/lib/request-organization";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

/** Orchestrator fan-out: CP STAFF_PROVISIONED / STAFF_DEACTIVATED. */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/integration/staff-provision", async (httpReq, httpRes) => {
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

  // SEC-HOT-01: fail closed in production when bridge secret unset
  const secret = process.env.SATELLITE_BRIDGE_SECRET?.trim() ?? "";
  const header = request.headers.get("x-satellite-bridge-secret")?.trim() ?? "";
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return sendJson(httpRes, { error: "Unauthorized" }, 401);
    }
  } else if (header !== secret) {
    return sendJson(httpRes, { error: "Unauthorized" }, 401);
  }

  try {
    const event = (httpReq.body) as { organizationId?: string };
    const organizationId =
      typeof event.organizationId === "string" ? event.organizationId.trim() : "";
    if (!organizationId) {
      return sendJson(httpRes, { error: "organizationId required" }, 400);
    }
    enterRequestTenant(organizationId);
    const result = await handleStaffProvisionEvent(event);
    return sendJson(httpRes, result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Provision failed";
    const prismaCode =
      typeof err === "object" && err !== null && "code" in err
        ? String((err as { code: unknown }).code)
        : "";
    const code =
      err instanceof SatelliteLoginTakenError || prismaCode === "P2002"
        ? "LOGIN_TAKEN"
        : err instanceof SatelliteTargetAmbiguousError
          ? "TARGET_AMBIGUOUS"
          : undefined;
    const status =
      code === "LOGIN_TAKEN" || code === "TARGET_AMBIGUOUS" ? 409 : 400;
    return sendJson(httpRes, { error: message, ...(code ? { code } : {}) }, ( { status }).status ?? 200);
  }

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
