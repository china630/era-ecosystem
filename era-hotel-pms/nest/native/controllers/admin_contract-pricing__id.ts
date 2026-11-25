/** Lifted from era-hotel-pms/nest/generated/admin_contract-pricing__id.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const RETIRED = {
  error: 'Contract pricing API retired',
  hint: 'use SalesContract',
};


@Controller()
export class AdminContractPricingIdController {
  @Patch("api/admin/contract-pricing/:id")
  @HttpCode(200)
  async patch_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
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

  @Delete("api/admin/contract-pricing/:id")
  @HttpCode(200)
  async delete_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
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
