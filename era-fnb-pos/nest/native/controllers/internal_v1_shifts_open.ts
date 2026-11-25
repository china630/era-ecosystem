/** Lifted from nest/generated/internal_v1_shifts_open.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { enterRequestTenant } from "@/lib/request-organization";
import { listAllOpenPosShifts } from "@/lib/shift.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

function organizationIdFrom(req: { get?: (name: string) => string | undefined; headers?: Record<string, unknown>; originalUrl?: string; url?: string }): string {
  const header = nestHeader(req, "x-era-organization-id")?.trim() || "";
  const query = new URL(req.originalUrl ?? req.url ?? "/", "http://127.0.0.1").searchParams.get("organizationId")?.trim() || "";
  return header || query;
}

/** Hotel night audit asks which outlets still have a live open shift. */


@Controller()
export class InternalV1ShiftsOpenController {
  @Get("api/internal/v1/shifts/open")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      

  const secret = process.env.POS_BRIDGE_SECRET?.trim();
  const header = nestHeader(httpReq, "x-pos-bridge-secret")?.trim() ?? "";
  if (!secret || header !== secret) {
    return sendJson(httpRes, { error: "Unauthorized" }, 401);
  }

  const organizationId = organizationIdFrom(httpReq);
  if (!organizationId || organizationId === "demo-org") {
    return sendJson(httpRes, { error: "organizationId required" }, 400);
  }

  try {
    enterRequestTenant(organizationId);
    const { resolveCatalogOrganizationId } = await import("@era/satellite-kit");
    const shifts = await listAllOpenPosShifts();
    const matched = [];
    for (const shift of shifts) {
      const hub = await resolveCatalogOrganizationId(shift.organizationId);
      if (hub === organizationId || shift.organizationId === organizationId) {
        matched.push(shift);
      }
    }
    const openShifts = matched;
    return sendJson(httpRes, {
      open: openShifts
        .filter((shift) => shift.outlet?.code)
        .map((shift) => ({
          outletCode: shift.outlet.code,
          shiftId: shift.id,
          openedAt: shift.openedAt.toISOString(),
        })),
    });
  } catch (err) {
    console.error("[shifts/open]", err);
    return sendJson(httpRes, { error: "Open shift list failed" }, 500);
  }

        });
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
