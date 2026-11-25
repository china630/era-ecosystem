/** Lifted from era-hotel-pms/nest/generated/admin_contract-pricing.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const RETIRED = {
  error: 'Contract pricing API retired',
  hint: 'use SalesContract',
};


@Controller()
export class AdminContractPricingController {
  @Get("api/admin/contract-pricing")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  return sendJson(httpRes, RETIRED, 410);

        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/admin/contract-pricing")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  return sendJson(httpRes, RETIRED, 410);

        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
