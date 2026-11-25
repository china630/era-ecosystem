import { Controller, HttpCode, Post, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  nestHeader,
  withClinicHttp,
} from "../../bridge";
import { handleStaffProvisionEvent, SatelliteLoginTakenError, SatelliteTargetAmbiguousError } from "@/lib/staff-provision";
import { enterRequestTenant } from "@/lib/request-organization";


function bridgeSecret(): string {
  return (
    process.env.SATELLITE_BRIDGE_SECRET?.trim() ||
    process.env.CLINIC_BRIDGE_SECRET?.trim() ||
    ""
  );
}

/** Orchestrator fan-out: CP STAFF_PROVISIONED / STAFF_DEACTIVATED. */

@Controller()
export class IntegrationStaffProvisionController {

  @Post("api/integration/staff-provision")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      // SEC-HOT-01: fail closed in production when bridge secret unset
  const secret = bridgeSecret();
  const header = nestHeader(httpReq, "x-satellite-bridge-secret")?.trim() ?? "";
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new HttpException({ error: "Unauthorized" }, 401);
    }
  } else if (header !== secret) {
    throw new HttpException({ error: "Unauthorized" }, 401);
  }

  try {
    const event = (httpReq.body) as { organizationId?: string };
    const organizationId =
      typeof event.organizationId === "string" ? event.organizationId.trim() : "";
    if (!organizationId) {
      throw new HttpException({ error: "organizationId required" }, 400);
    }
    enterRequestTenant(organizationId);
    const result = await handleStaffProvisionEvent(event);
    return result;
  } catch (err) {
    if (err instanceof HttpException) throw err;
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
    throw new HttpException({ error: message, ...(code ? { code } : {}) }, ( { status }).status ?? 200);
  }

        });
  }
}
