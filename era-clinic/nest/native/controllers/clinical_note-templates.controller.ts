import { Controller, Get, HttpCode, Req, UseGuards } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import { withClinicStaff, clinicBody } from "../../bridge";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { listActiveNoteTemplates } from "@/domain/notes/clinical-note.service";

@Controller()
export class ClinicalNoteTemplatesController {
  @UseGuards(ClinicApiGuard)
  @Get("api/clinical-note-templates")
  @HttpCode(200)
  async getActive(@Req() httpReq: Request) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_VISITS_READ);
      if (denied) return clinicBody(denied);
      return { items: await listActiveNoteTemplates() };
    });
  }
}