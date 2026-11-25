import { expressKitHeaders } from "@era/satellite-kit";
import { Controller, Delete, HttpCode, Patch, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { updatePractitionerOpsCatalog, deletePractitioner, auditMasterChange, getPractitionerById } from "@/lib/services/clinic-master-data.service";
import { isCpWorkforceHireModeActive } from "@/lib/workforce-policy";


const opsUpdateSchema = z.object({
  specialty: z.string().nullable().optional(),
  defaultSlotMinutes: z.number().int().min(5).max(240).optional(),
  staffKind: z.enum(["DOCTOR", "NURSE", "LAB", "BATH", "MASSAGE"]).optional(),
});

function isProvisionedPractitioner(row: {
  globalPersonId?: string | null;
  financeEmployeeId?: string | null;
}): boolean {
  return Boolean(row.globalPersonId || row.financeEmployeeId);
}

@Controller()
export class AdminPractitionersIdController {

  @Patch("api/admin/practitioners/:id")
  @HttpCode(200)
  async patch_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);

    const { id } = httpReq.params;
    const existing = await getPractitionerById(id);
    if (!existing) {
      throw new HttpException({ error: "Not found" }, 404);
    }

    const cpWorkforce = await isCpWorkforceHireModeActive();
    const provisioned = isProvisionedPractitioner(existing);

    if (cpWorkforce || provisioned) {
      const body = opsUpdateSchema.parse(httpReq.body);
      const row = await updatePractitionerOpsCatalog(id, body);
      await auditMasterChange(
        { userId: guard.session.sub, request: expressKitHeaders(httpReq) },
        "practitioner",
        id,
        "UPDATE_OPS",
        body,
      );
      return row;
    }

    throw new HttpException({ error: 
      "Identity changes via CP Workforce only. Enable platform_workforce and hire from Workspace.", ...{ code: "WORKFORCE_OPS_CATALOG_ONLY" } }, 403);
  
        });
  }

  @Delete("api/admin/practitioners/:id")
  @HttpCode(200)
  async delete_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);

    const { id } = httpReq.params;
    const existing = await getPractitionerById(id);
    if (!existing) {
      throw new HttpException({ error: "Not found" }, 404);
    }

    if (isProvisionedPractitioner(existing) || (await isCpWorkforceHireModeActive())) {
      throw new HttpException({ error: 
        "Deactivate provisioned staff in ERA Workspace → Workforce (terminate employment).", ...{ code: "WORKFORCE_DEACTIVATE_VIA_CP" } }, 403);
    }

    await deletePractitioner(id);
    await auditMasterChange(
      { userId: guard.session.sub, request: expressKitHeaders(httpReq) },
      "practitioner",
      id,
      "DELETE",
    );
    return { deleted: true };
  
        });
  }
}
