/** Lifted from era-hotel-pms/nest/generated/room-service_qr.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class RoomServiceQrController {
  @Get("api/room-service/qr")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    if (!(session)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const url = requestUrl;
    const roomId = url.searchParams.get("roomId") ?? "demo-room";
    const tableCode = url.searchParams.get("tableCode") ?? `RS-${roomId}`;
    return sendJson(httpRes, {
      roomId,
      tableCode,
      fbPosTicketUrl: `/api/tickets/room-service?tableCode=${encodeURIComponent(tableCode)}`,
      qrPayload: `era-fb://room-service/${tableCode}`,
    });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
