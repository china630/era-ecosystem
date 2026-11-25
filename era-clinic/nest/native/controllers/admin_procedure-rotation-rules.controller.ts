import { Controller, Delete, Get, HttpCode, Post, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { createRotationRule, deleteRotationRule, listRotationRules, updateRotationRule } from "@/lib/procedure-rotation.service";


const createSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  memberCodes: z.array(z.string().min(1)).min(1),
  scope: z.enum(["BODY_PART", "GROUP"]).default("GROUP"),
  maxConsecutiveDays: z.number().int().min(1).max(14).default(1),
  restProcedureCode: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});

@Controller()
export class AdminProcedureRotationRulesController {

  @Get("api/admin/procedure-rotation-rules")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    return await listRotationRules();
  
        });
  }

  @Post("api/admin/procedure-rotation-rules")
  @HttpCode(200)
  async post_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const body = createSchema.parse(httpReq.body);
    throw new HttpException(await createRotationRule(body), 201);
  
        });
  }

  @Delete("api/admin/procedure-rotation-rules")
  @HttpCode(200)
  async delete_2(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const id = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").searchParams.get("id");
    if (!id) throw new HttpException({ error: "id required" }, 400);
    await deleteRotationRule(id);
    return { deleted: true };
  
        });
  }
}
