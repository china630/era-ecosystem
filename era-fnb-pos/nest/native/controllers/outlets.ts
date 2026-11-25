/** Lifted from nest/generated/outlets.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { getSelectedOutletId } from "@/lib/outlet-session";
import { requestOrganizationId } from "@/lib/request-organization";
import { denyUnlessPermission, denyUnlessAnyPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { OUTLET_LIST_READ } from "@/lib/auth/read-permission-sets";
import { copyOutletLayoutFromSource, createOutlet, findActiveOutletForCopy, isOutletCodeDuplicateError, listActiveOutlets } from "@/lib/outlet.service";
import { defaultCapabilitiesForShape, OUTLET_SHAPE_HINTS, type OutletShapeHint } from "@/lib/outlet-capabilities";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const copySchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(120),
  copyFromOutletId: z.string().optional(),
  publicSlug: z.string().min(2).max(64).optional(),
  shapeHint: z.enum(OUTLET_SHAPE_HINTS).optional(),
  capTill: z.boolean().optional(),
  capTables: z.boolean().optional(),
  capBuffetPlanner: z.boolean().optional(),
});

async function registerCommercialOutletOnCp(input: {
  organizationId: string;
  code: string;
  name: string;
}): Promise<void> {
  const base =
    process.env.ORCHESTRATOR_URL?.trim() ||
    process.env.CONTROL_PLANE_URL?.trim() ||
    "";
  const token =
    process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim() ||
    process.env.CONTROL_PLANE_SERVICE_TOKEN?.trim() ||
    "";
  if (!base || !token) return;
  await fetch(`${base.replace(/\/$/, "")}/v1/internal/structure/outlets/upsert`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "x-service-token": token,
    },
    body: JSON.stringify({
      organizationId: input.organizationId,
      satelliteKey: "industry_fnb_pos",
      code: input.code,
      name: input.name,
    }),
  });
}


@Controller()
export class OutletsController {
  @Get("api/outlets")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessAnyPermission(session, OUTLET_LIST_READ);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    const outlets = await listActiveOutlets();
    const selectedOutletId = await getSelectedOutletId();
    return sendJson(httpRes, { outlets, selectedOutletId });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }

  @Post("api/outlets")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  try {
    const denied = denyUnlessPermission(session, PERMISSIONS.OUTLETS_MANAGE);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    const body = copySchema.parse(httpReq.body);
    const organizationId = requestOrganizationId();
    const code = body.code.trim().toUpperCase();
    if (code === "RESTAURANT") {
      return sendJson(httpRes, { error: "Outlet code RESTAURANT is retired — use NAFTANI" }, 400);
    }

    const shape: OutletShapeHint = body.shapeHint ?? "restaurant";
    const caps = defaultCapabilitiesForShape(shape);
    if (body.capTill !== undefined) caps.till = body.capTill;
    if (body.capTables !== undefined) caps.tables = body.capTables;
    if (body.capBuffetPlanner !== undefined) caps.buffetPlanner = body.capBuffetPlanner;

    let source: Awaited<ReturnType<typeof findActiveOutletForCopy>> = null;
    if (body.copyFromOutletId) {
      source = await findActiveOutletForCopy(body.copyFromOutletId, organizationId);
      if (!source) return sendJson(httpRes, { error: "Source outlet not found" }, 404);
    }

    const created = await createOutlet({
      organizationId,
      code,
      name: body.name.trim(),
      publicSlug: body.publicSlug ?? null,
      capTill: caps.till,
      capTables: caps.tables,
      capBuffetPlanner: caps.buffetPlanner,
      shapeHint: caps.shapeHint,
      ...(source
        ? {
            revenueCenterCode: source.revenueCenterCode,
            financeWarehouseCode: source.financeWarehouseCode,
            phone: source.phone,
            email: source.email,
            address: source.address,
            website: source.website,
          }
        : {}),
    });

    void registerCommercialOutletOnCp({
      organizationId,
      code,
      name: body.name.trim(),
    }).catch(() => undefined);

    if (source) {
      await copyOutletLayoutFromSource(source.id, created.id, organizationId);
    }

    return sendJson(httpRes, created, 201);
  } catch (err) {
    if (isOutletCodeDuplicateError(err)) {
      return sendJson(httpRes, { error: "Outlet code already exists" }, 409);
    }
    return sendRouteError(httpRes, err);
  }

      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
