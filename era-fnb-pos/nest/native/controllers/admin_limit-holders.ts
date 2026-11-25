/** Lifted from nest/generated/admin_limit-holders.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { denyUnlessAnyPermission, denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { createFnbLimitHolder, listFnbLimitHolders } from "@/lib/limit-holder.service";
import { requestOrganizationId } from "@/lib/request-organization";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const createSchema = z.object({
  displayName: z.string().min(1).max(120),
  ceilingAzn: z.number().positive(),
  outletId: z.string().min(1).nullable().optional(),
});


@Controller()
export class AdminLimitHoldersController {
  @Get("api/admin/limit-holders")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessAnyPermission(session, [
      PERMISSIONS.SCREEN_ADMIN_LIMITS,
      PERMISSIONS.TICKETS_PAY,
    ]);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    const organizationId = requestOrganizationId();
    const rows = await listFnbLimitHolders(organizationId);
    return sendJson(httpRes, 
      rows.map((row) => ({
        ...row,
        ceilingAzn: Number(row.ceilingAzn),
        usedAzn: Number(row.usedAzn),
        availableAzn: Math.round((Number(row.ceilingAzn) - Number(row.usedAzn)) * 100) / 100,
      })),
    );
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }

  @Post("api/admin/limit-holders")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessPermission(session, PERMISSIONS.OUTLETS_MANAGE);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    const body = createSchema.parse(httpReq.body);
    const organizationId = requestOrganizationId();
    const row = await createFnbLimitHolder(organizationId, {
      displayName: body.displayName.trim(),
      ceilingAzn: body.ceilingAzn,
      outletId: body.outletId ?? null,
    });
    return sendJson(httpRes, row, 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
