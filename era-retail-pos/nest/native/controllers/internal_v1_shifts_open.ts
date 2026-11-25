/** Lifted from nest/generated/internal_v1_shifts_open.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { enterRequestTenant } from "@/lib/request-organization";
import { listOpenShiftsForHub } from "@/lib/shift.service";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

function organizationIdFrom(request: Request): string {
  return (
    request.headers.get("x-era-organization-id")?.trim() ||
    new URL(request.url).searchParams.get("organizationId")?.trim() ||
    ""
  );
}

/** Hotel night audit asks which retail outlets still have an open shift. */


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
  const organizationId = organizationIdFrom(request);
  if (!organizationId || organizationId === "demo-org") {
    return sendJson(httpRes, { error: "organizationId required" }, 400);
  }
  try {
    enterRequestTenant(organizationId);
    const { resolveCatalogOrganizationId } = await import("@era/satellite-kit");
    const shifts = await listOpenShiftsForHub();
    const open = [];
    for (const shift of shifts) {
      const hub = await resolveCatalogOrganizationId(shift.organizationId);
      if (hub !== organizationId && shift.organizationId !== organizationId) continue;
      const outletCode = shift.register?.outlet?.code?.trim();
      if (!outletCode) continue;
      open.push({
        outletCode,
        shiftId: shift.id,
        openedAt: shift.openedAt.toISOString(),
      });
    }
    return sendJson(httpRes, { open });
  } catch (err) {
    console.error("[retail shifts/open]", err);
    return sendJson(httpRes, { error: "Open shift list failed" }, 500);
  }

        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
