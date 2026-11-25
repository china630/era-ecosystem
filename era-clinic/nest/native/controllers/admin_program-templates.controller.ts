import { Controller, Delete, Get, HttpCode, Post, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { programTemplateCreateSchema, shapeProgramTemplate, listProgramTemplatesForAdmin, createProgramTemplateFromAdmin, findCurrentProgramTemplateByCode, deleteProgramTemplateAdmin, parseDateOnly, bakuDateOnly, purgeRetiredTemplatesWithoutInstances, backfillEntitlementSnapshots } from "@/domain/sanatorium/program-template-admin";

@Controller()
export class AdminProgramTemplatesController {

  @Get("api/admin/program-templates")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    const includeRetired = url.searchParams.get("includeRetired") === "1";
    return await listProgramTemplatesForAdmin(includeRetired);
  
        });
  }

  @Post("api/admin/program-templates")
  @HttpCode(200)
  async post_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    const action = url.searchParams.get("action");

    if (action === "purge-retired") {
      const body = ((httpReq.body ?? {})) as {
        olderThanDays?: number;
      };
      const result = await purgeRetiredTemplatesWithoutInstances({
        olderThanDays:
          typeof body.olderThanDays === "number" ? body.olderThanDays : 0,
      });
      return result;
    }
    if (action === "backfill-snapshots") {
      const result = await backfillEntitlementSnapshots();
      return result;
    }

    const body = programTemplateCreateSchema.parse(httpReq.body);
    const existingCurrent = await findCurrentProgramTemplateByCode(body.code);
    if (existingCurrent) {
      throw new HttpException({ error: "CODE_EXISTS", message: "A current package with this code already exists" }, 409);
    }
    const effectiveFrom =
      parseDateOnly(body.effectiveFrom ?? null) ?? parseDateOnly(bakuDateOnly());
    const effectiveTo = parseDateOnly(body.effectiveTo ?? null);
    if (effectiveFrom && effectiveTo && effectiveTo < effectiveFrom) {
      throw new HttpException({ error: "INVALID_VALIDITY_RANGE", message: "Valid-to must not precede valid-from" }, 400);
    }
    const row = await createProgramTemplateFromAdmin(body);
    throw new HttpException(shapeProgramTemplate({ ...row, openInstanceCount: 0, pinInstanceCount: 0 }), 201);
  
        });
  }

  @Delete("api/admin/program-templates")
  @HttpCode(200)
  async delete_2(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const id = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").searchParams.get("id");
    if (!id) throw new HttpException({ error: "id required" }, 400);
    const result = await deleteProgramTemplateAdmin(id);
    if (result.closed) {
      return {
        deleted: false,
        closed: true,
        effectiveTo: result.effectiveTo,
        pinnedInstances: result.pinnedInstances,
      };
    }
    return { deleted: true, closed: false };
  
        });
  }
}
