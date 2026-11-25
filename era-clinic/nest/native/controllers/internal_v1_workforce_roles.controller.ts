import { Controller, Get, HttpCode, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  nestHeader,
  withClinicHttp,
} from "../../bridge";
import { enterRequestTenant } from "@/lib/request-organization";
import { listWorkforceOrgRoles } from "@/domain/auth/clinic-rbac.service";


function bridgeSecret(): string {
  return process.env.SATELLITE_BRIDGE_SECRET?.trim() || "";
}

/** Control plane reads role codes. Permissions stay on this satellite. */

@Controller()
export class InternalV1WorkforceRolesController {

  @Get("api/internal/v1/workforce/roles")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const secret = bridgeSecret();
  const header = nestHeader(httpReq, "x-satellite-bridge-secret")?.trim() ?? "";
  if (!secret || header !== secret) {
    throw new HttpException({ error: "Unauthorized" }, 401);
  }
  const organizationId =
    new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").searchParams.get("organizationId")?.trim() ?? "";
  if (!organizationId) {
    throw new HttpException({ error: "organizationId required" }, 400);
  }
  enterRequestTenant(organizationId);
  const roles = await listWorkforceOrgRoles(organizationId);
  return {
    roles: roles.map((role) => ({
      code: role.code,
      name: role.name,
      active: true,
    })),
  };

        });
  }
}
