import type { Request as ExpressRequest, Response as ExpressResponse } from "express";
import { Controller, Get, HttpCode, Post, Req, Res } from "@nestjs/common";
import { createOrganizationBindHandlers, createRuntimeConfigHandlers, type KitHttpResult } from "@era/satellite-kit";
import { expressKitHeaders } from "./express-kit-headers";
import { readBillingStatusFrom } from "@era/satellite-kit/billing/status-route";
import { prisma } from "@/lib/prisma";
import { upsertClinicCutoverPolicy } from "@/domain/physio/clinic-cutover.service";
import { ensureClinicCatalogIfEmpty } from "@/domain/catalog/ensure-clinic-catalog-from-templates";
import { ensureSystemClinicRoles } from "@/lib/auth/ensure-system-clinic-roles";
import { runWithStaffTenantIfPresent, sendRouteError } from "./bridge";

const runtimeConfig = createRuntimeConfigHandlers({
  getPrisma: () => prisma,
  onClinicCutover: async (organizationId, policy) => {
    await upsertClinicCutoverPolicy(organizationId, policy);
  },
});

const organizationBind = createOrganizationBindHandlers({
  getPrisma: () => prisma,
});

async function bindWrite(req: ExpressRequest): Promise<KitHttpResult> {
  const result = await organizationBind.writeFrom(expressKitHeaders(req), req.body);
  if (result.status >= 400) return result;
  try {
    const body = result.body as { organizationId?: string };
    const orgId = body.organizationId?.trim();
    if (orgId && orgId !== "demo-org") {
      await ensureSystemClinicRoles(prisma, orgId);
      await ensureClinicCatalogIfEmpty(prisma, orgId);
    }
  } catch (err) {
    console.error("[clinic] post-bind catalog ensure failed", err);
  }
  return result;
}

@Controller()
export class ClinicKitController {
  @Get("api/platform/billing-status")
  @HttpCode(200)
  billing(@Req() req: ExpressRequest, @Res({ passthrough: false }) res: ExpressResponse) {
    return this.send(req, res, () => readBillingStatusFrom(expressKitHeaders(req)));
  }

  @Get("api/internal/v1/runtime-config")
  @HttpCode(200)
  runtimeGet(@Req() req: ExpressRequest, @Res({ passthrough: false }) res: ExpressResponse) {
    return this.send(req, res, () => runtimeConfig.readFrom(expressKitHeaders(req)));
  }

  @Post("api/internal/v1/runtime-config")
  @HttpCode(200)
  runtimePost(@Req() req: ExpressRequest, @Res({ passthrough: false }) res: ExpressResponse) {
    return this.send(req, res, () => runtimeConfig.writeFrom(expressKitHeaders(req), req.body));
  }

  @Get("api/internal/v1/organization/bind")
  @HttpCode(200)
  bindGet(@Req() req: ExpressRequest, @Res({ passthrough: false }) res: ExpressResponse) {
    return this.send(req, res, () => organizationBind.readFrom(expressKitHeaders(req)));
  }

  @Post("api/internal/v1/organization/bind")
  @HttpCode(200)
  bindPostRoute(@Req() req: ExpressRequest, @Res({ passthrough: false }) res: ExpressResponse) {
    return this.send(req, res, () => bindWrite(req));
  }

  private async send(
    httpReq: ExpressRequest,
    httpRes: ExpressResponse,
    run: () => Promise<KitHttpResult>,
  ) {
    try {
      const result = await runWithStaffTenantIfPresent(httpReq, run);
      if (!result || typeof result !== "object" || !("status" in result)) return;
      const row = result as KitHttpResult;
      if (row.headers) {
        for (const [key, value] of Object.entries(row.headers)) httpRes.setHeader(key, value);
      }
      httpRes.status(row.status).json(row.body);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
