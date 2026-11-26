/** Lifted from era-hotel-pms/nest/generated/internal_v1_revenue-codes.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { enterRequestTenant } from "@/lib/request-organization";
import { listActiveRevenueCodeSummaries } from "@/lib/services/master-data.service";
import { assertEnvServiceToken } from "@era/satellite-kit";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

function unauthorized(message: string) {
  return Response.json({ error: message }, { status: 401 });
}

/**
 * Active hotel revenue codes for department satellites.
 * Bearer SATELLITE_EVENT_SERVICE_TOKEN. organizationId selects the tenant.
 */


@Controller()
export class InternalV1RevenueCodesController {
  @Get("api/internal/v1/revenue-codes")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  try {
    const gate = assertEnvServiceToken({
      expectedEnvKeys: ["SATELLITE_EVENT_SERVICE_TOKEN"],
      authorization: nestHeader(httpReq, "authorization"),
      xServiceToken: nestHeader(httpReq, "x-service-token"),
    });
    if (!gate.ok) return unauthorized(gate.error);

    const url = requestUrl;
    const organizationId = url.searchParams.get("organizationId")?.trim() ?? "";
    if (!organizationId) {
      return sendJson(httpRes, { error: "organizationId required" }, 400);
    }
    enterRequestTenant(organizationId);
    const codes = await listActiveRevenueCodeSummaries();
    return sendJson(httpRes, { codes });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Revenue codes failed";
    return sendJson(httpRes, { error: message }, 500);
  }

        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
