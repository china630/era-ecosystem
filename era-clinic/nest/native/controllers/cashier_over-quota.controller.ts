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
import { listOverQuotaChargeLogs } from "@/domain/cashier/cashier-settle.service";


const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  unsettledOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  overQuotaOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v !== "false"),
});

@Controller()
export class CashierOverQuotaController {

  @UseGuards(ClinicApiGuard)
  @Get("api/cashier/over-quota")
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
      unsettledOnly: url.searchParams.get("unsettledOnly") ?? undefined,
      overQuotaOnly: url.searchParams.get("overQuotaOnly") ?? undefined,
    });

    const result = await listOverQuotaChargeLogs({
      page: query.page,
      pageSize: query.pageSize,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      unsettledOnly: query.unsettledOnly,
      overQuotaOnly: query.overQuotaOnly,
    });

    return result;
  
        });
  }
}
