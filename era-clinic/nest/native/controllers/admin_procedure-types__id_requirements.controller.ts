import { expressKitHeaders } from "@era/satellite-kit";
import { Controller, Get, HttpCode, Put, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { listProcedureTypeRequirements, replaceProcedureTypeRequirements, auditMasterChange, getProcedureTypeById } from "@/lib/services/clinic-master-data.service";


const requirementSchema = z.object({
  role: z.enum(["LOCATION", "EQUIPMENT", "STAFF"]),
  resourceKind: z.enum(["ROOM", "EQUIPMENT"]).nullable().optional(),
  resourceCode: z.string().nullable().optional(),
  quantity: z.number().int().positive().optional(),
  staffMode: z.enum(["HARD", "SOFT"]).optional(),
  required: z.boolean().optional(),
});

const putSchema = z.object({
  requirements: z.array(requirementSchema),
});

@Controller()
export class AdminProcedureTypesIdRequirementsController {

  @Get("api/admin/procedure-types/:id/requirements")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const { id } = httpReq.params;
    const existing = await getProcedureTypeById(id);
    if (!existing) throw new HttpException({ error: "Not found" }, 404);
    return await listProcedureTypeRequirements(id);
  
        });
  }

  @Put("api/admin/procedure-types/:id/requirements")
  @HttpCode(200)
  async put_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const { id } = httpReq.params;
    const existing = await getProcedureTypeById(id);
    if (!existing) throw new HttpException({ error: "Not found" }, 404);
    const body = putSchema.parse(httpReq.body);
    const rows = await replaceProcedureTypeRequirements(id, body.requirements);
    await auditMasterChange(
      { userId: guard.session.sub, request: expressKitHeaders(httpReq) },
      "procedureTypeRequirement",
      id,
      "REPLACE",
      body,
    );
    return rows;
  
        });
  }
}
