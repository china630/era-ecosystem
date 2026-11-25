import { Controller, HttpCode, Post, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  nestHeader,
  withClinicHttp,
} from "../../bridge";
import { z } from "zod";

import { enterRequestTenant } from "@/lib/request-organization";
import { applyHotelVoidToExtra } from "@/domain/sanatorium/extras-assign.service";


/**
 * CLI-57 W4 — hotel folio void inbound → cancel clinic extra + invalidate ticket.
 * Auth: Bearer SATELLITE_EVENT_SERVICE_TOKEN (same class as lifecycle).
 */
const schema = z.object({
  organizationId: z.string().min(1),
  externalTicketId: z.string().optional(),
  orderId: z.string().optional(),
});

function assertServiceToken(req: Request): boolean {
  const expected = process.env.SATELLITE_EVENT_SERVICE_TOKEN;
  if (!expected) return false;
  const auth = nestHeader(req, "authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return token === expected;
}

@Controller()
export class InternalV1ExtrasHotelVoidController {

  @Post("api/internal/v1/extras/hotel-void")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      if (!assertServiceToken(httpReq)) throw new HttpException({ error: "Unauthorized" }, 401);
    const body = schema.parse(httpReq.body);
    if (!body.externalTicketId && !body.orderId) {
      throw new HttpException({ error: "externalTicketId or orderId required" }, 400);
    }
    enterRequestTenant(body.organizationId);
    const result = await applyHotelVoidToExtra({
      externalTicketId: body.externalTicketId,
      orderId: body.orderId,
    });
    return result;
  
        });
  }
}
