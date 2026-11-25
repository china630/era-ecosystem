import { Controller, Get, HttpCode, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { readBillingStatusFrom } from "@era/satellite-kit/billing/status-route";
import {
  createOrganizationBindHandlers,
  createRuntimeConfigHandlers,
  expressKitHeaders,
  type KitHttpResult,
} from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";
import { upsertElektrawebBridgePolicy } from "@/lib/integration/elektraweb-bridge/config";
import { replaceFiscalDeviceMirror } from "@/lib/fiscal-device-mirror";
import { runWithStaffTenantIfPresent, sendRouteError } from "./bridge";

const runtimeConfig = createRuntimeConfigHandlers({
  getPrisma: () => prisma,
  onElektrawebBridge: async (organizationId, policy) => {
    await upsertElektrawebBridgePolicy(organizationId, policy);
  },
  onFiscalDevices: async (organizationId, devices) => {
    await replaceFiscalDeviceMirror(organizationId, devices);
  },
});

const organizationBind = createOrganizationBindHandlers({
  getPrisma: () => prisma,
});

@Controller()
export class KitApiController {
  @Get("api/platform/billing-status")
  @HttpCode(200)
  billing(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    return send(req, res, () => readBillingStatusFrom(expressKitHeaders(req)));
  }

  @Get("api/internal/v1/runtime-config")
  @HttpCode(200)
  runtimeGet(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    return send(req, res, () => runtimeConfig.readFrom(expressKitHeaders(req)));
  }

  @Post("api/internal/v1/runtime-config")
  @HttpCode(200)
  runtimePost(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    return send(req, res, () => runtimeConfig.writeFrom(expressKitHeaders(req), req.body));
  }

  @Get("api/internal/v1/organization/bind")
  @HttpCode(200)
  bindGet(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    return send(req, res, () => organizationBind.readFrom(expressKitHeaders(req)));
  }

  @Post("api/internal/v1/organization/bind")
  @HttpCode(200)
  bindPost(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    return send(req, res, () => organizationBind.writeFrom(expressKitHeaders(req), req.body));
  }
}

async function send(httpReq: Request, httpRes: Response, run: () => Promise<KitHttpResult>) {
  try {
    const result = await runWithStaffTenantIfPresent(httpReq, run);
    if (!result || typeof result !== "object" || !("status" in result)) return;
    if (result.headers) {
      for (const [key, value] of Object.entries(result.headers)) httpRes.setHeader(key, value);
    }
    httpRes.status(result.status).json(result.body);
  } catch (err) {
    await sendRouteError(httpRes, err);
  }
}
