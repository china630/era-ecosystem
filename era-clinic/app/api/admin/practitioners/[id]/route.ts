import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminWrite } from "@/lib/auth/clinic-admin-guard";
import {
  updatePractitioner,
  deletePractitioner,
  auditMasterChange,
  listPractitioners,
} from "@/lib/services/clinic-master-data.service";
import { linkPractitionerGlobalPerson } from "@/lib/practitioner-identity";

const updateSchema = z.object({
  fullName: z.string().min(1).optional(),
  specialty: z.string().nullable().optional(),
  finCode: z.string().optional(),
  passportNumber: z.string().optional(),
  issuingCountry: z.string().optional(),
  phone: z.string().optional(),
  globalPersonId: z.string().nullable().optional(),
  defaultSlotMinutes: z.number().int().min(5).max(240).optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await assertClinicAdminWrite();
    if (guard.error) return guard.error;
    const { id } = await ctx.params;
    const body = updateSchema.parse(await req.json());

    const row = await updatePractitioner(id, {
      fullName: body.fullName,
      specialty: body.specialty,
      finCode: body.finCode ?? undefined,
      passportNumber: body.passportNumber ?? undefined,
      issuingCountry: body.issuingCountry ?? undefined,
      phone: body.phone ?? undefined,
      globalPersonId: body.globalPersonId,
      defaultSlotMinutes: body.defaultSlotMinutes,
    });

    if (
      body.finCode?.trim() ||
      body.passportNumber?.trim() ||
      body.fullName?.trim()
    ) {
      await linkPractitionerGlobalPerson({
        practitionerId: id,
        fullName: body.fullName ?? row.fullName,
        fin: body.finCode,
        passport: body.passportNumber,
        issuingCountry: body.issuingCountry,
        phone: body.phone,
      });
    }

    const refreshed = await listPractitioners().then((rows) =>
      rows.find((r) => r.id === id),
    );

    await auditMasterChange(
      { userId: guard.session.sub, request: req },
      "practitioner",
      id,
      "UPDATE",
      body,
    );
    return jsonOk(refreshed ?? row);
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
