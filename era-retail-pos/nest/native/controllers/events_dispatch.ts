/** Lifted from nest/generated/events_dispatch.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { randomUUID } from "crypto";
import { isSatelliteEvent } from "@era/contracts";
import { assertEnvServiceToken, assertRevenueEventForPublish, organizationIdOnIncomingRequest, publishToOrchestratorGateway } from "@era/satellite-kit";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

/** SEC-SAT-01: require service token; never trust client organizationId or the process bind. */


@Controller()
export class EventsDispatchController {
  @Post("api/events/dispatch")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  const authz = assertEnvServiceToken({
    expectedEnvKeys: ["SATELLITE_EVENT_SERVICE_TOKEN"],
    authorization: nestHeader(httpReq, "authorization"),
    xServiceToken: nestHeader(httpReq, "x-service-token"),
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
  try {
    await assertRevenueEventForPublish({
      organizationId,
      fromSatelliteKey: "industry_retail",
      eventType: String(event.type),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Revenue channel disabled";
    return sendJson(httpRes, { ok: false, error: message }, 403);
  }
  const result = await publishToOrchestratorGateway(event as Record<string, unknown>);
  if (!result.ok) {
    return sendJson(httpRes, { ok: false, error: result.error }, 502);
  }
  return sendJson(httpRes, { ok: true, event });

        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
