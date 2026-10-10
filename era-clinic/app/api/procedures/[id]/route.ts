import { z } from "zod";
import { jsonOk, jsonError, handleRouteError, getSatelliteSession, requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { patchProcedureOrderPhysio, toPhysioOrderPayload } from "@/domain/physio/physio-order-sites.service";
import { getProcedureOrderCard } from "@/domain/procedure/procedure-order-card.service";

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

/** Reception card for one scheduled procedure (matrix click). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSatelliteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PROCEDURES_READ);
    if (denied) return denied;
    const { id } = await params;
    const card = await getProcedureOrderCard(id);
    if (!card) return jsonError("Not found", 404);
    return jsonOk(card);
  } catch (err) {
    return handleRouteError(err);
  }
}

/** Patch PROPOSED/SCHEDULED order: S chips, type-gated fields, note. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSatelliteSession();
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
