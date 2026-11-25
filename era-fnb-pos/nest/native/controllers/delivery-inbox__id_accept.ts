/** Lifted from nest/generated/delivery-inbox__id_accept.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { acceptDeliveryInboxOrder, findDeliveryInboxOrderById } from "@/lib/delivery-inbox.service";
import { denyUnlessAnyPermission } from "@/lib/auth/require";
import { DELIVERY_ACCEPT } from "@/lib/auth/read-permission-sets";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class DeliveryInboxIdAcceptController {
  @Post("api/delivery-inbox/:id/accept")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessAnyPermission(session, DELIVERY_ACCEPT);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    const { id } = httpReq.params;
    const order = await findDeliveryInboxOrderById(id);
    if (!order) {
      return sendJson(httpRes, { error: "Order not found" }, 404);
    }
    const updated = await acceptDeliveryInboxOrder(id);
    return sendJson(httpRes, updated);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
