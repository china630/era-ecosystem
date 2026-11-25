import { expressKitHeaders } from "../../express-kit-headers";
import { Controller, Get, HttpCode, Put, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { listProcedureConsumableLines, replaceProcedureConsumableLines, auditMasterChange, getProcedureTypeById } from "@/lib/services/clinic-master-data.service";


const lineSchema = z.object({
  sku: z.string().min(1),
  financeProductId: z.string().nullable().optional(),
  qtyPerSession: z.number().positive().optional(),
  wasteFactor: z.number().min(0).optional(),
});

const putSchema = z.object({
  lines: z.array(lineSchema),
});

@Controller()
export class AdminProcedureTypesIdConsumablesController {

  @Get("api/admin/procedure-types/:id/consumables")
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
    return await listProcedureConsumableLines(id);
  
        });
  }

  @Put("api/admin/procedure-types/:id/consumables")
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
    const rows = await replaceProcedureConsumableLines(id, body.lines);
    await auditMasterChange(
      { userId: guard.session.sub, request: expressKitHeaders(httpReq) },
      "procedureConsumableLine",
      id,
      "REPLACE",
      body,
    );
    return rows;
  
        });
  }
}
