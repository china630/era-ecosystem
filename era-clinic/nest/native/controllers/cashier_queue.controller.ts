import { Controller, Get, HttpCode, Req, UseGuards } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { listCashierQueue } from "@/domain/cashier/cashier-bill.service";


const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  patientRefId: z.string().optional(),
  origin: z.enum(["WALK_IN", "IN_HOUSE"]).optional(),
  channel: z
    .enum(["LOCAL", "FINANCE", "HOTEL_FOLIO", "SETTLEMENT_HUB"])
    .optional(),
});

@Controller()
export class CashierQueueController {

  @UseGuards(ClinicApiGuard)
  @Get("api/cashier/queue")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_CASHIER);
    if (denied) return clinicBody(denied);

    const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    const query = querySchema.parse({
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
      dateFrom: url.searchParams.get("dateFrom") ?? undefined,
      dateTo: url.searchParams.get("dateTo") ?? undefined,
      patientRefId: url.searchParams.get("patientRefId") ?? undefined,
      origin: url.searchParams.get("origin") ?? undefined,
      channel: url.searchParams.get("channel") ?? undefined,
    });

    const result = await listCashierQueue(query);
    return result;
  
        });
  }
}
