import { Controller, Get, HttpCode, Post, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicBody,
  clinicRoute,
} from "../../bridge";
import { z } from "zod";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { PeakRuleConflictError, createPeakRule, listPeakRules } from "@/domain/planning/peak-rules.service";


const bodySchema = z.object({
  fromYmd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toYmd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dayKind: z.enum(["WORKING", "SHORT"]),
  scope: z.enum(["OWN_ONLY", "EMPTY_DEFAULT", "CLINIC_WIDE"]),
  startHour: z.number().int().min(0).max(23).nullable().optional(),
  endHour: z.number().int().min(1).max(24).nullable().optional(),
  note: z.string().nullable().optional(),
});

@Controller()
export class AdminPeakRulesController {

  @Get("api/admin/peak-rules")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    return await listPeakRules();
  
        });
  }

  @Post("api/admin/peak-rules")
  @HttpCode(200)
  async post_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      try {
    const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const body = bodySchema.parse(httpReq.body);
    const row = await createPeakRule(body);
    return row;
  } catch (err) {
    if (err instanceof HttpException) throw err;
    if (err instanceof PeakRuleConflictError) {
      throw new HttpException({ error: err.message, code: "PEAK_OVERLAP", conflictId: err.conflictId }, 409);
    }
    return clinicBody(handleRouteError(err));
  }

        });
  }
}
