/** Lifted from era-hotel-pms/nest/generated/admin_price-seasons__id.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { serialize } from "@/lib/serialize";
import { assertMasterDataWrite } from "@/lib/auth/master-data-guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { updatePriceSeason } from "@/lib/services/price-season.service";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  startsOn: z.string().min(8),
  endsOn: z.string().min(8),
});


@Controller()
export class AdminPriceSeasonsIdController {
  @Patch("api/admin/price-seasons/:id")
  @HttpCode(200)
  async patch_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertMasterDataWrite(session, PERMISSIONS.SEASONS_ADMIN);
    const { id } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);
    const row = await updatePriceSeason(id, body, session?.sub);
    return sendJson(httpRes, serialize(row));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
