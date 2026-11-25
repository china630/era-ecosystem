/** Lifted from era-hotel-pms/nest/generated/fiscal_devices.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class FiscalDevicesController {
  @Get("api/fiscal/devices")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const url = requestUrl;
    const outletCode = url.searchParams.get("outlet") ?? undefined;
    const registerRef = url.searchParams.get("register") ?? undefined;
    const kind = url.searchParams.get("kind") as
      | "FISCAL_KKM"
      | "BANK_POS"
      | undefined;
    const { listDevicesForSatellite, resolveDefaultDevicesForSatellite } =
      await import("@era/satellite-kit");
    const { ensureFiscalDevices } = await import("@/lib/fiscal-device-mirror");
    const organizationId = session.organizationId;
    await ensureFiscalDevices(organizationId);
    return sendJson(httpRes, {
      devices: listDevicesForSatellite({
        organizationId,
        outletCode,
        registerRef,
        kind,
      }),
      defaults: resolveDefaultDevicesForSatellite({
        organizationId,
        outletCode,
        registerRef,
      }),
    });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
