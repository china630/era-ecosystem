import { Controller, Get, HttpCode, Post, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import { withClinicHttp, clinicBody } from "../../bridge";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { clinicRoute } from "../../bridge";
import { z } from "zod";
import {
  createPatientFormTemplate,
  listPatientFormTemplates,
} from "@/domain/forms/patient-form.service";

const createSchema = z.object({
  code: z.string().min(2),
  titleEn: z.string().min(1),
  titleRu: z.string().min(1),
  titleAz: z.string().min(1),
  sectionsJson: z.string().min(2),
  consentRequired: z.boolean().optional(),
});

@Controller()
export class AdminPatientFormTemplatesController {
  @Get("api/admin/patient-form-templates")
  @HttpCode(200)
  async getList(@Req() httpReq: Request) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
      if (guard.error) return clinicBody(guard.error);
      const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const includeInactive = url.searchParams.get("includeInactive") === "1";
      return { items: await listPatientFormTemplates(includeInactive) };
    });
  }

  @Post("api/admin/patient-form-templates")
  @HttpCode(200)
  async postCreate(@Req() httpReq: Request) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
      if (guard.error) return clinicBody(guard.error);
      const body = createSchema.parse(httpReq.body);
      const row = await createPatientFormTemplate(body);
      throw new HttpException(row, 201);
    });
  }
}