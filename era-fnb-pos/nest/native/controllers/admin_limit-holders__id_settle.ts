/** Lifted from nest/generated/admin_limit-holders__id_settle.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { findFnbLimitHolderByOrg, updateFnbLimitHolderUsedAzn } from "@/lib/limit-holder.service";
import { requestOrganizationId } from "@/lib/request-organization";
import { recordFbAudit } from "@/lib/satellite-audit";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({ amount: z.number().positive() });

/** Pay down the holder's debt. The ceiling is usable again only for the settled part. */


@Controller()
export class AdminLimitHoldersIdSettleController {
  @Post("api/admin/limit-holders/:id/settle")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessPermission(session, PERMISSIONS.OUTLETS_MANAGE);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    const { id } = httpReq.params;
    const body = bodySchema.parse(httpReq.body);
    const organizationId = requestOrganizationId();
    const holder = await findFnbLimitHolderByOrg(organizationId, id);
    if (!holder) return sendJson(httpRes, { error: "Limit holder not found" }, 404);
    const used = Number(holder.usedAzn);
    if (body.amount > used + 0.001) return sendJson(httpRes, { error: "Settlement is above the open debt" }, 400);
    const next = Math.max(0, Math.round((used - body.amount) * 100) / 100);
    const updated = await updateFnbLimitHolderUsedAzn(id, next);
    await recordFbAudit({ userId: session?.sub, request: { headers: { get: (name: string) => nestHeader(httpReq, name) } } }, "FnbLimitHolder", id, "SETTLE", {
      amount: body.amount,
      usedAzn: next,
    });
    return sendJson(httpRes, {
      id: updated.id,
      usedAzn: next,
      availableAzn: Math.round((Number(updated.ceilingAzn) - next) * 100) / 100,
    });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
