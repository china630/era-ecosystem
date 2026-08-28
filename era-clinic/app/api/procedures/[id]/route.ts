import { z } from "zod";
import { jsonOk, handleRouteError, getRouteSession, requireClinicRole } from "@/lib/api-utils";
import { CLINIC_ROLE } from "@/lib/clinic-roles";
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
    const denied = requireClinicRole(session, [CLINIC_ROLE.DOCTOR, CLINIC_ROLE.RECEPTION]);
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
