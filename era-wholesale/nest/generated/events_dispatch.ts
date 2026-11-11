import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { isSatelliteEvent } from "@era/contracts";
import { assertEnvServiceToken, organizationIdOnIncomingRequest, publishToOrchestratorGateway } from "@era/satellite-kit";
import { enterWholesaleStaff, wholesaleNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithWholesaleTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

/** SEC-SAT-01: require service token; never trust client organizationId or the process bind. */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/events/dispatch", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const req = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  const authz = assertEnvServiceToken({
    expectedEnvKeys: ["SATELLITE_EVENT_SERVICE_TOKEN"],
    authorization: req.headers.get("authorization"),
    xServiceToken: req.headers.get("x-service-token"),
    // Always require token — route is on public API prefix (SEC-SAT-01)
    allowOpenInNonProduction: false,
  });
  if (!authz.ok) {
    return sendJson(httpRes, { ok: false, error: authz.error }, ( { status: authz.status }).status ?? 200);
  }

  const organizationId = organizationIdOnIncomingRequest(req);
  if (!organizationId) {
    return sendJson(httpRes, 
      { ok: false, error: "organizationId is not bound on this request" }, 400);
  }

  const body = (httpReq.body) as Record<string, unknown>;
  const event = {
    ...body,
    organizationId,
    correlationId:
      typeof body.correlationId === "string" ? body.correlationId : randomUUID(),
    occurredAt:
      typeof body.occurredAt === "string"
        ? body.occurredAt
        : new Date().toISOString(),
  };
  if (!isSatelliteEvent(event)) {
    return sendJson(httpRes, 
      { ok: false, error: "Unknown or invalid satellite event type" }, 400);
  }
  const result = await publishToOrchestratorGateway(event as Record<string, unknown>);
  if (!result.ok) {
    return sendJson(httpRes, { ok: false, error: result.error }, 502);
  }
  return sendJson(httpRes, { ok: true, event });

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
