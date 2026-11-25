import { Controller, Get, HttpCode, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { listClinicDays, listClinicDayOverrideRows, upsertClinicDayOverride } from "@/domain/planning/clinic-day";
import { requestOrganizationId } from "@/lib/request-organization";
import { addBakuDays } from "@/lib/baku-day";


const bodySchema = z.object({
  dayYmd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dayKind: z.enum(["WORKING", "SHORT", "CLOSED"]).optional(),
  closed: z.boolean().optional(),
  startHour: z.number().int().min(0).max(23).nullable().optional(),
  endHour: z.number().int().min(0).max(24).nullable().optional(),
  note: z.string().nullable().optional(),
});

@Controller()
export class AdminClinicDaysController {

  @Get("api/admin/clinic-days")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
      const days = await listClinicDays(from, to < from ? addBakuDays(from, 1) : to);
      return days;
    }
    const rows = await listClinicDayOverrideRows();
    return rows;
  
        });
  }

  @Post("api/admin/clinic-days")
  @HttpCode(200)
  async post_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const body = bodySchema.parse(httpReq.body);
    const organizationId = requestOrganizationId();
    const dayKind =
      body.dayKind ??
      (body.closed === true ? "CLOSED" : body.closed === false ? "WORKING" : "WORKING");
    const closed = dayKind === "CLOSED";
    const row = await upsertClinicDayOverride({
      organizationId,
      dayYmd: body.dayYmd,
      closed,
      dayKind,
      startHour: closed ? null : (body.startHour ?? null),
      endHour: closed ? null : (body.endHour ?? null),
      note: body.note ?? null,
    });
    return row;
  
        });
  }
}
