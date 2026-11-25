/** Lifted from nest/generated/integration_staff-provision.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { handleStaffProvisionEvent, SatelliteLoginTakenError, SatelliteTargetAmbiguousError } from "@/lib/staff-provision";
import { enterRequestTenant } from "@/lib/request-organization";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

/** Orchestrator fan-out: CP STAFF_PROVISIONED / STAFF_DEACTIVATED. */


@Controller()
export class IntegrationStaffProvisionController {
  @Post("api/integration/staff-provision")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      

  // SEC-HOT-01: fail closed in production when bridge secret unset
  const secret = process.env.SATELLITE_BRIDGE_SECRET?.trim() ?? "";
  const header = nestHeader(httpReq, "x-satellite-bridge-secret")?.trim() ?? "";
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
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
