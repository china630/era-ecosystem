import { Controller, Get, HttpCode, Post, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import { withClinicHttp, clinicBody } from "../../bridge";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { clinicRoute } from "../../bridge";
import {
  createNoteTemplateAdmin,
  listNoteTemplatesAdmin,
  noteTemplateUpsertSchema,
} from "@/domain/notes/note-template-admin.service";

@Controller()
export class AdminNoteTemplatesController {
  @Get("api/admin/note-templates")
  @HttpCode(200)
  async getList(@Req() httpReq: Request) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
      if (guard.error) return clinicBody(guard.error);
      const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const includeInactive = url.searchParams.get("includeInactive") === "1";
      return { items: await listNoteTemplatesAdmin(includeInactive) };
    });
  }

  @Post("api/admin/note-templates")
  @HttpCode(200)
  async postCreate(@Req() httpReq: Request) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
      if (guard.error) return clinicBody(guard.error);
      const body = noteTemplateUpsertSchema.parse(httpReq.body);
      const row = await createNoteTemplateAdmin(body, guard.session?.sub ?? "", httpReq);
      throw new HttpException(row, 201);
    });
  }
}