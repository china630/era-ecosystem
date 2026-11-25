/** Lifted from nest/generated/delivery-inbox.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { createDeliveryInboxOrder, listOpenDeliveryInboxOrders } from "@/lib/delivery-inbox.service";
import { denyUnlessAnyPermission } from "@/lib/auth/require";
import { DELIVERY_ACCEPT } from "@/lib/auth/read-permission-sets";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const createSchema = z.object({
  externalRef: z.string().min(1),
  channel: z.string().default("aggregator"),
  payload: z.record(z.unknown()).optional(),
});


@Controller()
export class DeliveryInboxController {
  @Get("api/delivery-inbox")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessAnyPermission(session, DELIVERY_ACCEPT);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    const orders = await listOpenDeliveryInboxOrders();
    return sendJson(httpRes, orders);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }

  @Post("api/delivery-inbox")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessAnyPermission(session, DELIVERY_ACCEPT);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    const body = createSchema.parse(httpReq.body);
    const order = await createDeliveryInboxOrder({
      externalRef: body.externalRef,
      channel: body.channel,
      payloadJson: body.payload ? JSON.stringify(body.payload) : null,
    });
    return sendJson(httpRes, order, 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
