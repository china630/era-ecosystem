import { Controller, Delete, Get, HttpCode, Post, Put, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  readNestForm,
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { listLabBlankAdminBundle } from "@/domain/catalog/diagnostic-catalog-admin.service";
import { deleteBlankProfile, saveBlankProfile } from "@/domain/lab/blank-apply";
import { extractBlankTable } from "@/domain/lab/blank-docx";


const saveSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  kind: z.enum(["TABLE", "NARRATIVE"]).default("TABLE"),
  serviceCode: z.string().nullable().optional(),
  rows: z.array(z.object({ sourceLabel: z.string().min(1), analyteCode: z.string().min(1) })),
});





/** Read a sample docx into label rows so an admin can map them. Does not invent analyte codes. */

@Controller()
export class AdminLabBlankProfilesController {

  @Get("api/admin/lab-blank-profiles")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    return await listLabBlankAdminBundle();
  
        });
  }

  @Post("api/admin/lab-blank-profiles")
  @HttpCode(200)
  async post_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const body = saveSchema.parse(httpReq.body);
    throw new HttpException(await saveBlankProfile(body), 201);
  
        });
  }

  @Put("api/admin/lab-blank-profiles")
  @HttpCode(200)
  async put_2(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const form = await readNestForm(httpReq);
    const file = form.get("file");
    if (!(file instanceof File)) return { rows: [] };
    const rows = extractBlankTable(Buffer.from(await file.arrayBuffer()));
    return { rows };
  
        });
  }

  @Delete("api/admin/lab-blank-profiles")
  @HttpCode(200)
  async delete_3(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const id = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").searchParams.get("id")?.trim() ?? "";
    if (!id) throw new HttpException({ error: "id required" }, 400);
    await deleteBlankProfile(id);
    return { deleted: true };
  
        });
  }
}
