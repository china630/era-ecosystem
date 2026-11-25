/** Lifted from nest/generated/fiscal_devices.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

/** List fiscal KKM / bank POS devices for cashier pick (F3). */


@Controller()
export class FiscalDevicesController {
  @Get("api/fiscal/devices")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessPermission(
      session,
      PERMISSIONS.TICKETS_PAY,
    );
    if (denied || !session) {
      return sendJson(httpRes, denied?.body ?? { error: "Unauthorized" }, denied?.status ?? 401);
    }

    const url = new URL(new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").toString());
    const outletCode = url.searchParams.get("outlet") ?? undefined;
    const registerRef = url.searchParams.get("register") ?? undefined;
    const kind = url.searchParams.get("kind") as
      | "FISCAL_KKM"
      | "BANK_POS"
      | undefined;

    const { listDevicesForSatellite, resolveDefaultDevicesForSatellite } =
      await import("@era/satellite-kit");
    const organizationId = session.organizationId;
    const devices = listDevicesForSatellite({
      organizationId,
      outletCode,
      registerRef,
      kind,
    });
    const defaults = resolveDefaultDevicesForSatellite({
      organizationId,
      outletCode,
      registerRef,
    });
    return sendJson(httpRes, { devices, defaults });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
