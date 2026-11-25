import { Controller, Delete, Get, HttpCode, Post, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { createSubstitutionRule, deleteSubstitutionRule, listSubstitutionRules } from "@/lib/procedure-substitution.service";


const createSchema = z.object({
  originalCode: z.string().min(1),
  substituteCode: z.string().min(1),
  note: z.string().nullable().optional(),
});

@Controller()
export class AdminProcedureSubstitutionRulesController {

  @Get("api/admin/procedure-substitution-rules")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    return await listSubstitutionRules();
  
        });
  }

  @Post("api/admin/procedure-substitution-rules")
  @HttpCode(200)
  async post_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const body = createSchema.parse(httpReq.body);
    throw new HttpException(await createSubstitutionRule(body), 201);
  
        });
  }

  @Delete("api/admin/procedure-substitution-rules")
  @HttpCode(200)
  async delete_2(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const id = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").searchParams.get("id");
    if (!id) throw new HttpException({ error: "id required" }, 400);
    await deleteSubstitutionRule(id);
    return { deleted: true };
  
        });
  }
}
