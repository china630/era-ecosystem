import { Controller, HttpCode, Patch, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import { withClinicHttp, clinicBody, clinicRoute } from "../../bridge";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { noteTemplateUpsertSchema, updateNoteTemplateAdmin } from "@/domain/notes/note-template-admin.service";

@Controller()
export class AdminNoteTemplatesIdController {
  @Patch("api/admin/note-templates/:id")
  @HttpCode(200)
  async patchTemplate(@Req() httpReq: Request) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
      if (guard.error) return clinicBody(guard.error);
      const partial = noteTemplateUpsertSchema.partial().parse(httpReq.body);
      const { id } = httpReq.params;
      const row = await updateNoteTemplateAdmin(id, partial, guard.session?.sub ?? "", httpReq);
      return row;
    });
  }
}