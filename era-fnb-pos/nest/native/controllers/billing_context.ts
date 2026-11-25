/** Lifted from nest/generated/billing_context.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { resolveSettlementPolicy, shouldDeferWalkInToHub } from "@era/satellite-kit";
import { requestOrganizationId } from "@/lib/request-organization";
import { denyUnlessAnyPermission } from "@/lib/auth/require";
import { TILL_READ_TICKETS } from "@/lib/auth/read-permission-sets";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class BillingContextController {
  @Get("api/billing/context")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessAnyPermission(session, TILL_READ_TICKETS);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    const orgId = requestOrganizationId();
    const policy = await resolveSettlementPolicy(orgId);
    return sendJson(httpRes, {
      deferWalkInToHub: shouldDeferWalkInToHub(policy),
      settlementHub: policy.settlementHub,
    });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
