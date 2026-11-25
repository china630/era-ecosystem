/** Lifted from nest/generated/internal_v1_kafe_bootstrap-owner.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { assertEnvServiceToken } from "@era/satellite-kit";
import { bootstrapKafeOwner } from "@/lib/kafe-org-bootstrap";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class InternalV1KafeBootstrapOwnerController {
  @Post("api/internal/v1/kafe/bootstrap-owner")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      

  const authz = assertEnvServiceToken({
    expectedEnvKeys: [
      "SATELLITE_EVENT_SERVICE_TOKEN",
      "CONTROL_PLANE_SERVICE_TOKEN",
    ],
    authorization: nestHeader(httpReq, "authorization"),
    xServiceToken: nestHeader(httpReq, "x-service-token"),
    allowOpenInNonProduction: false,
  });
  if (!authz.ok) {
    return sendJson(httpRes, { error: authz.error }, ( { status: authz.status }).status ?? 200);
  }

  let body: {
    organizationId?: unknown;
    email?: unknown;
    password?: unknown;
    fullName?: unknown;
    cafeName?: unknown;
    activeModules?: unknown;
  };
  try {
    body = (httpReq.body) as typeof body;
  } catch {
    return sendJson(httpRes, { error: "Invalid JSON" }, 400);
  }

  const organizationId =
    typeof body.organizationId === "string" ? body.organizationId.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const fullName = typeof body.fullName === "string" ? body.fullName : "";
  const cafeName = typeof body.cafeName === "string" ? body.cafeName : "";
  const activeModules = Array.isArray(body.activeModules)
    ? body.activeModules.filter((k): k is string => typeof k === "string")
    : [];

  try {
    const result = await bootstrapKafeOwner({
      organizationId,
      email,
      password,
      fullName,
      cafeName,
      activeModules,
    });
    return sendJson(httpRes, { ok: true, login: result.login });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bootstrap failed";
    return sendJson(httpRes, { error: message }, 400);
  }

        });
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
