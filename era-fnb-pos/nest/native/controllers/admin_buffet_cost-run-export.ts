/** Lifted from nest/generated/admin_buffet_cost-run-export.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { describeRouteError } from "@/lib/api-utils";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { exportBuffetCostRunSlice } from "@/lib/buffet-cost-run-export.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

/**
 * Buffet cost-run export for Finance (Waves 3–4).
 * POS sale + named COMP bucket from closed tickets; staff overlap netting.
 * Unit COGS map is optional until Finance prices BOM (warnings when missing).
 */
const bodySchema = z.object({
  outletId: z.string().min(1),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  foodUsageAzn: z.number().min(0).default(0),
  staffGrossAzn: z.number().min(0).default(0),
  unitCogsBySku: z.record(z.string(), z.number().min(0)).optional(),
  defaultUnitCogsAzn: z.number().min(0).optional(),
});

const querySchema = z.object({
  outletId: z.string().min(1),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  foodUsageAzn: z.coerce.number().min(0).default(0),
  staffGrossAzn: z.coerce.number().min(0).default(0),
  defaultUnitCogsAzn: z.coerce.number().min(0).optional(),
});

function mapExportError(err: unknown) {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code?: string }).code;
    if (code === "OUTLET_NOT_FOUND") return { status: 404, body: { error: "Outlet not found" } };
    if (code === "INVALID_DATE_RANGE") {
      return { status: 400, body: { error: "from must be on or before to (YYYY-MM-DD)" } };
    }
  }
  return null;
}

function assertDateOrder(from: string, to: string) {
  if (from > to) {
    throw Object.assign(new Error("INVALID_DATE_RANGE"), { code: "INVALID_DATE_RANGE" });
  }
}


@Controller()
export class AdminBuffetCostRunExportController {
  @Get("api/admin/buffet/cost-run-export")
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
      foodUsageAzn: url.searchParams.get("foodUsageAzn") ?? "0",
      staffGrossAzn: url.searchParams.get("staffGrossAzn") ?? "0",
      defaultUnitCogsAzn: url.searchParams.get("defaultUnitCogsAzn") ?? undefined,
    });
    assertDateOrder(parsed.from, parsed.to);
    const slice = await exportBuffetCostRunSlice({
      outletId: parsed.outletId,
      fromYmd: parsed.from,
      toYmd: parsed.to,
      foodUsageAzn: parsed.foodUsageAzn,
      staffGrossAzn: parsed.staffGrossAzn,
      defaultUnitCogsAzn: parsed.defaultUnitCogsAzn,
    });
    return sendJson(httpRes, slice);
  } catch (err) {
    const described = mapExportError(err) ?? describeRouteError(err);
    return sendJson(httpRes, described.body, described.status);
  }

      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }

  @Post("api/admin/buffet/cost-run-export")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  try {
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const body = bodySchema.parse(httpReq.body);
    assertDateOrder(body.from, body.to);
    const slice = await exportBuffetCostRunSlice({
      outletId: body.outletId,
      fromYmd: body.from,
      toYmd: body.to,
      foodUsageAzn: body.foodUsageAzn,
      staffGrossAzn: body.staffGrossAzn,
      unitCogsBySku: body.unitCogsBySku,
      defaultUnitCogsAzn: body.defaultUnitCogsAzn,
    });
    return sendJson(httpRes, slice);
  } catch (err) {
    const described = mapExportError(err) ?? describeRouteError(err);
    return sendJson(httpRes, described.body, described.status);
  }

      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
