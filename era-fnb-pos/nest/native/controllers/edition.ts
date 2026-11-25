/** Lifted from nest/generated/edition.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { getFnbOrgProfile } from "@/lib/fnb-org-profile";
import { allowedFnbPresets, fnbKitchenOn } from "@/lib/fnb-edition";
import { requestOrganizationId } from "@/lib/request-organization";
import { resolveHotelOrganizationId } from "@/lib/pms-bridge-client";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class EditionController {
  @Get("api/edition")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    if (!(session)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const profile = await getFnbOrgProfile();
    let folioPostEnabled = false;
    let settlementEnabled = false;
    try {
      const { checkChannelEnabledLive } = await import("@era/satellite-kit");
      const hotelOrg = await resolveHotelOrganizationId();
      const fnbOrg = requestOrganizationId();
      if (hotelOrg && fnbOrg) {
        const [folio, settlement] = await Promise.all([
          checkChannelEnabledLive({
            fromOrgId: fnbOrg,
            fromSatelliteKey: "industry_fnb_pos",
            toOrgId: hotelOrg,
            toSatelliteKey: "industry_hotel_pms",
            kind: "FOLIO_POST",
          }),
          checkChannelEnabledLive({
            fromOrgId: fnbOrg,
            fromSatelliteKey: "industry_fnb_pos",
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
    }
    return sendJson(httpRes, {
      edition: profile.edition,
      hotelMode: profile.hotelMode,
      enabledPresets: profile.enabledPresets,
      allowedPresets: allowedFnbPresets(profile.edition),
      kitchen: fnbKitchenOn(profile),
      waiterPinPacks: profile.waiterPinPacks,
      activeModules: profile.activeModules,
      folioPostEnabled,
      settlementEnabled,
    });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
