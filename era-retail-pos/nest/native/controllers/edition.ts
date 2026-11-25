/** Lifted from nest/generated/edition.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { hotelOrganizationId } from "@/lib/pms-bridge-client";
import { requestOrganizationId } from "@/lib/request-organization";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class EditionController {
  @Get("api/edition")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterRetailStaff(httpReq, httpRes))) return;
    try {
      const session = await retailNestSession(httpReq);
      const web = await runWithRetailTenant(session, async () => {

  
    if (!(session)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    let folioPostEnabled = false;
    let settlementEnabled = false;
    let hotelLinked = false;
    try {
      const { checkChannelEnabledLive } = await import("@era/satellite-kit");
      const hotelOrg = await hotelOrganizationId();
      const retailOrg = requestOrganizationId();
      hotelLinked = Boolean(hotelOrg && retailOrg);
      if (hotelOrg && retailOrg) {
        const [folio, settlement] = await Promise.all([
          checkChannelEnabledLive({
            fromOrgId: retailOrg,
            fromSatelliteKey: "industry_retail",
            toOrgId: hotelOrg,
            toSatelliteKey: "industry_hotel_pms",
            kind: "FOLIO_POST",
          }),
          checkChannelEnabledLive({
            fromOrgId: retailOrg,
            fromSatelliteKey: "industry_retail",
            toOrgId: hotelOrg,
            toSatelliteKey: "industry_hotel_pms",
            kind: "SETTLEMENT",
          }),
        ]);
        folioPostEnabled = folio;
        settlementEnabled = settlement;
      }
    } catch {
      folioPostEnabled = false;
      settlementEnabled = false;
      hotelLinked = false;
    }
    return sendJson(httpRes, { folioPostEnabled, settlementEnabled, hotelLinked });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
