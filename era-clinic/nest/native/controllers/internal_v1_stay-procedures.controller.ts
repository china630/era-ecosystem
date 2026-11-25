import { Controller, Get, HttpCode, Post, Req, Res, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  nestHeader,
  withClinicHttp,
} from "../../bridge";
import { enterRequestTenant } from "@/lib/request-organization";
import { clearStayProceduresAtCheckout, listStayProceduresForCheckout } from "@/domain/sanatorium/stay-checkout-snapshot.service";
import { z } from "zod";


function assertServiceToken(req: Request): boolean {
  const expected = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();
  if (!expected) return false;
  const auth = nestHeader(req, "authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return token === expected;
}

/** Hotel checkout reads paid procedures and package attendance for one reservation. */


const clearSchema = z.object({
  organizationId: z.string().min(1),
  reservationId: z.string().min(1),
});

/** Hotel check-out: cancel future extras / package seats; apply no-show policy. */

@Controller()
export class InternalV1StayProceduresController {

  @Get("api/internal/v1/stay-procedures")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      if (!assertServiceToken(httpReq)) throw new HttpException({ error: "Unauthorized" }, 401);
    const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    const organizationId = url.searchParams.get("organizationId")?.trim() ?? "";
    const reservationId = url.searchParams.get("reservationId")?.trim() ?? "";
    if (!organizationId || !reservationId) {
      throw new HttpException({ error: "organizationId and reservationId required" }, 400);
    }
    enterRequestTenant(organizationId);
    return await listStayProceduresForCheckout(reservationId);
  
        });
  }

  @Post("api/internal/v1/stay-procedures")
  @HttpCode(200)
  async post_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      if (!assertServiceToken(httpReq)) throw new HttpException({ error: "Unauthorized" }, 401);
    const body = clearSchema.parse(httpReq.body);
    enterRequestTenant(body.organizationId);
    const { closeOpenEpisodesForReservation } = await import("@/lib/lifecycle-consumer");
    const closed = await closeOpenEpisodesForReservation(body.reservationId);
    const cleared = await clearStayProceduresAtCheckout(body.reservationId);
    const cancelledOrderIds = [
      ...new Set([...closed.cancelledOrderIds, ...cleared.cancelledOrderIds]),
    ];
    return { ...cleared, cancelledOrderIds };
  
        });
  }
}
