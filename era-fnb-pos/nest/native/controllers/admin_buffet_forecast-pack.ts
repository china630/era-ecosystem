/** Lifted from nest/generated/admin_buffet_forecast-pack.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { getBuffetForecastPackReport } from "@/lib/buffet-forecast-pack.service";
import { patchBuffetCostSettings } from "@/lib/buffet-cost-settings.service";
import { parseBuffetForecastPack } from "@/lib/buffet-forecast-pack";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const patchSchema = z
  .object({
    forecastPack: z
      .object({
        keySkuNorms: z
          .array(
            z.object({
              sku: z.string().min(1),
              name: z.string().min(1),
              unit: z.string().min(1),
              qtyPerGuestNight: z.number().min(0),
              aznPerGuestNight: z.number().min(0),
            }),
          )
          .min(1)
          .optional(),
        bands: z
          .array(
            z.object({
              code: z.string().min(1),
              minGuestNights: z.number().int().min(0),
              maxGuestNights: z.number().int().min(0).nullable(),
            }),
          )
          .min(1)
          .optional(),
      })
      .refine((v) => v.keySkuNorms != null || v.bands != null, {
        message: "forecastPack requires keySkuNorms and/or bands",
      }),
  })
  .strict();



/** Save key-SKU norms / bands into org buffet cost settings. */


@Controller()
export class AdminBuffetForecastPackController {
  @Get("api/admin/buffet/forecast-pack")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  try {
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const url = new URL(new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").toString());
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const overrideRaw = url.searchParams.get("guestNights");
    if (!from || !to) return sendJson(httpRes, { error: "from and to are required" }, 400);
    let guestNightsOverride: number | undefined;
    if (overrideRaw != null && overrideRaw !== "") {
      const n = Number(overrideRaw);
      if (!Number.isFinite(n) || n < 0) {
        return sendJson(httpRes, { error: "guestNights must be a non-negative number" }, 400);
      }
      guestNightsOverride = Math.floor(n);
    }
    const report = await getBuffetForecastPackReport({
      fromYmd: from,
      toYmd: to,
      guestNightsOverride,
    });
    return sendJson(httpRes, report);
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      ((err as { code?: string }).code === "BAD_DATE" ||
        (err as { code?: string }).code === "DATE_ORDER")
    ) {
      const msg = (err as unknown as { message?: unknown }).message;
      return sendJson(httpRes, { error: typeof msg === "string" ? msg : "Invalid date range" }, 400);
    }
    return sendRouteError(httpRes, err);
  }

      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }

  @Patch("api/admin/buffet/forecast-pack")
  @HttpCode(200)
  async patch_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const body = patchSchema.parse(httpReq.body);
    const forecastPack = parseBuffetForecastPack(body.forecastPack);
    const settings = await patchBuffetCostSettings({ forecastPack });
    return sendJson(httpRes, { forecastPack: settings.forecastPack });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
