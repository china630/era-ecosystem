/** Lifted from nest/generated/labor_roster.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { countActiveWaitersForOrg, hashStaffPin, listActiveStaffRoster, upsertStaffRosterRow } from "@/lib/labor-pin";
import { requestOrganizationId } from "@/lib/request-organization";
import { getFnbOrgProfile } from "@/lib/fnb-org-profile";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { denyUnlessAnyPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { ROSTER_WRITE } from "@/lib/auth/read-permission-sets";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({
  staffCode: z.string(),
  fullName: z.string(),
  pin: z.string().min(6).max(8),
  pinRole: z.enum(["CASHIER", "WAITER", "KITCHEN", "MANAGER"]).default("CASHIER"),
  outletId: z.string().min(1),
  globalPersonId: z.string().uuid().optional(),
});


@Controller()
export class LaborRosterController {
  @Get("api/labor/roster")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {

  
    const denied = denyUnlessAnyPermission(session, [
      PERMISSIONS.LABOR_ROSTER_READ,
      PERMISSIONS.STAFF_PIN,
      PERMISSIONS.LABOR_ROSTER_WRITE,
    ]);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    const roster = await listActiveStaffRoster();
    return sendJson(httpRes, { roster });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }

  @Post("api/labor/roster")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {

  
    const denied = denyUnlessAnyPermission(session, ROSTER_WRITE);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    const body = bodySchema.parse(httpReq.body);
    const organizationId = requestOrganizationId();
    const profile = await getFnbOrgProfile(organizationId);
    const manualRoster = !profile.hotelMode;
    if (!body.globalPersonId && !manualRoster) {
      return sendJson(httpRes, { error: 
        "Manual roster create requires globalPersonId from Finance HR STAFF_PROVISIONED" }, 422);
    }
    if (body.pinRole === "WAITER") {
      await requireFnbSubmodule("fnb_waiter_pin", organizationId);
      const waiters = await countActiveWaitersForOrg(organizationId);
      const cap = Math.max(0, profile.waiterPinPacks) * 5;
      if (waiters >= cap) {
        return sendJson(httpRes, { error: 
          `Waiter PIN pack full (${cap}). Buy another +19 pack.` }, 402);
      }
    }
    const row = await upsertStaffRosterRow({
      organizationId,
      staffCode: body.staffCode,
      fullName: body.fullName,
      pinHash: hashStaffPin(body.pin),
      pinRole: body.pinRole,
      outletId: body.outletId,
      globalPersonId: body.globalPersonId,
    });
    return sendJson(httpRes, row, 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
