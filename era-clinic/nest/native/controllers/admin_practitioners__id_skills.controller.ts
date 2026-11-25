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
import { getPractitionerById, listPractitionerSkills, setPractitionerSkills, auditMasterChange } from "@/lib/services/clinic-master-data.service";


const putSchema = z.object({
  procedureTypeIds: z.array(z.string().min(1)),
});

@Controller()
export class AdminPractitionersIdSkillsController {

  @Get("api/admin/practitioners/:id/skills")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const { id } = httpReq.params;
    const existing = await getPractitionerById(id);
    if (!existing) throw new HttpException({ error: "Not found" }, 404);
    return await listPractitionerSkills(id);
  
        });
  }

  @Put("api/admin/practitioners/:id/skills")
  @HttpCode(200)
  async put_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const { id } = httpReq.params;
    const existing = await getPractitionerById(id);
    if (!existing) throw new HttpException({ error: "Not found" }, 404);
    const body = putSchema.parse(httpReq.body);
    const rows = await setPractitionerSkills(id, body.procedureTypeIds);
    await auditMasterChange(
      { userId: guard.session.sub, request: expressKitHeaders(httpReq) },
      "practitionerSkill",
      id,
      "REPLACE",
      body,
    );
    return rows;
  
        });
  }
}
