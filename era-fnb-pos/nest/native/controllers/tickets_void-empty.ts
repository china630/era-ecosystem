/** Lifted from nest/generated/tickets_void-empty.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requestOrganizationId } from "@/lib/request-organization";
import { voidEmptyOpenTickets } from "@/lib/ticket-helpers";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

/** One-shot cleanup of open checks that have no live lines. */


@Controller()
export class TicketsVoidEmptyController {
  @Post("api/tickets/void-empty")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessPermission(session, PERMISSIONS.TICKETS_OPEN);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    const voided = await voidEmptyOpenTickets(requestOrganizationId());
    return sendJson(httpRes, { voided });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
