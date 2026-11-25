import { Controller, Delete, Get, HttpCode, Post, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { z } from 'zod';
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { listCompatibilityRules, createCompatibilityRule, deleteCompatibilityRule } from '@/lib/procedure-compatibility.service';


const createSchema = z.object({
  procedureCodeA: z.string().min(1),
  procedureCodeB: z.string().min(1),
  ruleType: z.enum(['FORBID_SAME_DAY', 'MIN_HOURS_GAP', 'FORBID_SEQUENCE']),
  minHours: z.number().int().positive().optional(),
  note: z.string().optional(),
});

@Controller()
export class AdminProcedureCompatibilityRulesController {

  @Get("api/admin/procedure-compatibility-rules")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    return await listCompatibilityRules();
  
        });
  }

  @Post("api/admin/procedure-compatibility-rules")
  @HttpCode(200)
  async post_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const body = createSchema.parse(httpReq.body);
    throw new HttpException(await createCompatibilityRule(body), 201);
  
        });
  }

  @Delete("api/admin/procedure-compatibility-rules")
  @HttpCode(200)
  async delete_2(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const id = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").searchParams.get('id');
    if (!id) throw new Error('id required');
    await deleteCompatibilityRule(id);
    return { deleted: true };
  
        });
  }
}
