/** Lifted from nest/generated/admin_buffet_hybrid-handoff.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { describeRouteError } from "@/lib/api-utils";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { buildHybridHandoffPack } from "@/lib/buffet-hybrid-handoff.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

/**
 * F&B → Finance HYBRID handoff pack (Phase A).
 * POS sale/COMP + staff net + Forecast theoretical → financeHandoffQuery.
 */
const querySchema = z.object({
  outletId: z.string().min(1),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  staffGrossAzn: z.coerce.number().min(0).optional(),
});

function mapHandoffError(err: unknown) {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code?: string }).code;
    if (code === "OUTLET_NOT_FOUND") return { status: 404, body: { error: "Outlet not found" } };
    if (code === "INVALID_DATE_RANGE" || code === "DATE_ORDER" || code === "BAD_DATE") {
      return { status: 400, body: { error: "from must be on or before to (YYYY-MM-DD)" } };
    }
  }
  return null;
}


@Controller()
export class AdminBuffetHybridHandoffController {
  @Get("api/admin/buffet/hybrid-handoff")
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
    const parsed = querySchema.parse({
      outletId: url.searchParams.get("outletId"),
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
      staffGrossAzn: url.searchParams.get("staffGrossAzn") ?? undefined,
    });
    if (parsed.from > parsed.to) {
      return sendJson(httpRes, { error: "from must be on or before to (YYYY-MM-DD)" }, 400);
    }
    const staffOverride = url.searchParams.has("staffGrossAzn");
    const pack = await buildHybridHandoffPack({
      outletId: parsed.outletId,
      fromYmd: parsed.from,
      toYmd: parsed.to,
      staffGrossAzn: parsed.staffGrossAzn,
      staffGrossOverride: staffOverride,
      financeWebUrl: await (async () => {
        const {
          getFnbIntegrationSettings,
          normalizePublicOrigin,
        } = await import("@/lib/fnb-integration-settings");
        const s = await getFnbIntegrationSettings();
        return normalizePublicOrigin(s.financeWebUrl);
      })(),
    });
    return sendJson(httpRes, pack);
  } catch (err) {
    const described = mapHandoffError(err) ?? describeRouteError(err);
    return sendJson(httpRes, described.body, described.status);
  }

      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
