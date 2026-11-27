import { Controller, Get, HttpCode, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { readBillingStatusFrom } from "@era/satellite-kit/billing/status-route";
import { expressKitHeaders, readPlatformLinks, type KitHttpResult } from "@era/satellite-kit";
import { runWithStaffTenantIfPresent, sendRouteError } from "./bridge";
import { organizationBind, runtimeConfig } from "./kit-routes";

/**
 * Kit bind / runtime-config / billing-status as Nest methods.
 * Headers and body come from the Express request.
 */
@Controller()
export class KitApiController {
  @Get("api/public/platform-links")
  @HttpCode(200)
  platformLinks(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    return send(req, res, async () => readPlatformLinks());
  }

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

async function send(
  httpReq: Request,
  httpRes: Response,
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
