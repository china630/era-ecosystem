/** Lifted from era-hotel-pms/nest/generated/auth_logout.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, cookieSeconds, sendRouteError } from "../../bridge";

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'era_session';


@Controller()
export class AuthLogoutController {
  @Post("api/auth/logout")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  cookieSeconds(httpRes, COOKIE_NAME, "", 0);
  return sendJson(httpRes, { ok: true });

        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
