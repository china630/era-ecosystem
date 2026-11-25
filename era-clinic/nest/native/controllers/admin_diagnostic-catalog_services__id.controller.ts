import { expressKitHeaders } from "../../express-kit-headers";
import { Controller, Delete, HttpCode, Patch, Req } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { updateService, deleteService } from "@/domain/catalog/diagnostic-catalog-admin.service";


const fieldDefSchema = z.object({
  key: z.string().min(1),
  type: z.string().min(1),
  label: z.object({ en: z.string(), ru: z.string(), az: z.string() }),
  unit: z.string().optional(),
  options: z.array(z.string()).optional(),
  required: z.boolean().optional(),
});

const updateSchema = z.object({
  code: z.string().min(1).optional(),
  modalityId: z.string().min(1).optional(),
  category: z.string().optional(),
  kind: z.string().min(1).optional(),
  titleEn: z.string().min(1).optional(),
  titleRu: z.string().min(1).optional(),
  titleAz: z.string().min(1).optional(),
  serviceCode: z.string().min(1).optional(),
  financeSku: z.string().nullable().optional(),
  fields: z.array(fieldDefSchema).nullable().optional(),
  includes: z.array(z.string()).nullable().optional(),
  guestBlankRelease: z.enum(["PAY_WITH_WORK", "AFTER_PAYMENT"]).optional(),
  menuSurface: z.enum(["LAB", "DIAGNOSTIC", "VISIT"]).nullable().optional(),
  autoPaidOnOpen: z.boolean().optional(),
  schedulingMode: z.enum(["FIXED", "OPEN"]).optional(),
  broughtInMaxDays: z.number().int().min(1).max(365).nullable().optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
  packageOnly: z.boolean().optional(),
});

@Controller()
export class AdminDiagnosticCatalogServicesIdController {

  @Patch("api/admin/diagnostic-catalog/services/:id")
  @HttpCode(200)
  async patch_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const { id } = httpReq.params;
    const body = updateSchema.parse(httpReq.body);
    const row = await updateService(
      { userId: guard.session.sub, request: expressKitHeaders(httpReq) },
      id,
      body,
    );
    return row;
  
        });
  }

  @Delete("api/admin/diagnostic-catalog/services/:id")
  @HttpCode(200)
  async delete_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const { id } = httpReq.params;
    await deleteService({ userId: guard.session.sub, request: expressKitHeaders(httpReq) }, id);
    return { deleted: true };
  
        });
  }
}
