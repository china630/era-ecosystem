import { z } from "zod";

import { jsonOk, handleRouteError, jsonError } from "@/lib/api-utils";

import { assertClinicAdminWrite } from "@/lib/auth/clinic-admin-guard";

import {
  updatePractitionerOpsCatalog,
  deletePractitioner,
  auditMasterChange,
  getPractitionerById,
} from "@/lib/services/clinic-master-data.service";

import { isCpWorkforceHireModeActive } from "@/lib/workforce-policy";

const opsUpdateSchema = z.object({
  specialty: z.string().nullable().optional(),
  defaultSlotMinutes: z.number().int().min(5).max(240).optional(),
});

function isProvisionedPractitioner(row: {
  globalPersonId?: string | null;
  financeEmployeeId?: string | null;
}): boolean {
  return Boolean(row.globalPersonId || row.financeEmployeeId);
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await assertClinicAdminWrite();
    if (guard.error) return guard.error;

    const { id } = await ctx.params;
    const existing = await getPractitionerById(id);
    if (!existing) {
      return jsonError("Not found", 404);
    }

    const cpWorkforce = await isCpWorkforceHireModeActive();
    const provisioned = isProvisionedPractitioner(existing);

    if (cpWorkforce || provisioned) {
      const body = opsUpdateSchema.parse(await req.json());
      const row = await updatePractitionerOpsCatalog(id, body);
      await auditMasterChange(
        { userId: guard.session.sub, request: req },
        "practitioner",
        id,
        "UPDATE_OPS",
        body,
      );
      return jsonOk(row);
    }

    return jsonError(
      "Identity changes via CP Workforce only. Enable platform_workforce and hire from Workspace.",
      403,
      { code: "WORKFORCE_OPS_CATALOG_ONLY" },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await assertClinicAdminWrite();
    if (guard.error) return guard.error;

    const { id } = await ctx.params;
    const existing = await getPractitionerById(id);
    if (!existing) {
      return jsonError("Not found", 404);
    }

    if (isProvisionedPractitioner(existing) || (await isCpWorkforceHireModeActive())) {
      return jsonError(
        "Deactivate provisioned staff in ERA Workspace → Workforce (terminate employment).",
        403,
        { code: "WORKFORCE_DEACTIVATE_VIA_CP" },
      );
    }

    await deletePractitioner(id);
    await auditMasterChange(
      { userId: guard.session.sub, request: req },
      "practitioner",
      id,
      "DELETE",
    );
    return jsonOk({ deleted: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
