/** Lifted from nest/generated/internal_v1_workforce_roles.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { listWorkforceRoleSummaries } from "@/lib/fnb-roles";
import { enterRequestTenant } from "@/lib/request-organization";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

function bridgeSecret(): string {
  return process.env.SATELLITE_BRIDGE_SECRET?.trim() || "";
}

/** Control plane reads role codes. Permissions stay on this satellite. */


@Controller()
export class InternalV1WorkforceRolesController {
  @Get("api/internal/v1/workforce/roles")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      

  const secret = bridgeSecret();
  const header = nestHeader(httpReq, "x-satellite-bridge-secret")?.trim() ?? "";
  if (!secret || header !== secret) {
    return sendJson(httpRes, { error: "Unauthorized" }, 401);
  }
  const organizationId =
    new URL(new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").toString()).searchParams.get("organizationId")?.trim() ?? "";
  if (!organizationId) {
    return sendJson(httpRes, { error: "organizationId required" }, 400);
  }
  enterRequestTenant(organizationId);
  const roles = await listWorkforceRoleSummaries(organizationId);
  return sendJson(httpRes, {
    roles: roles.map((role) => ({
      code: role.code,
      name: role.name,
      active: true,
    })),
  });

        });
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
