import { z } from "zod";
import { jsonOk, handleRouteError, getRouteSession, requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { patchProcedureOrderPhysio, toPhysioOrderPayload } from "@/domain/physio/physio-order-sites.service";

const patchSchema = z.object({
  bodyPart: z
    .enum([
      "HEAD",
      "NECK",
      "CHEST",
      "BACK",
      "ABDOMEN",
      "ARM_LEFT",
      "ARM_RIGHT",
      "LEG_LEFT",
      "LEG_RIGHT",
      "FULL_BODY",
    ])
    .nullable()
    .optional(),
  siteIds: z.array(z.string().min(1)).optional(),
  siteApplyMode: z.enum(["TOGETHER", "TURN"]).nullable().optional(),
  siteLaterality: z.record(z.enum(["LEFT", "RIGHT", "BOTH"]).nullable()).optional(),
  physioFields: z.record(z.unknown()).nullable().optional(),
  note: z.string().max(4000).nullable().optional(),
});

/** Patch PROPOSED/SCHEDULED order: S chips, type-gated fields, note. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PROCEDURES_DOCTOR_RECEPTION);
    if (denied) return denied;
    const { id } = await params;
    const body = patchSchema.parse(await req.json());
    const updated = await patchProcedureOrderPhysio(id, body);
    return jsonOk({
      ...updated,
      physio: toPhysioOrderPayload(updated),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
