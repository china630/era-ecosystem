import { z } from "zod";
import { jsonOk, jsonError, handleRouteError, getRouteSession, requireClinicRole } from "@/lib/api-utils";
import { CLINIC_ROLE } from "@/lib/clinic-roles";
import { rescheduleProcedureOrder } from "@/lib/procedure-scheduling.service";

const schema = z.object({
  scheduledAt: z.string().datetime(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    const denied = requireClinicRole(session, [
      CLINIC_ROLE.DOCTOR,
      CLINIC_ROLE.NURSE,
    ]);
    if (denied) return denied;

    const { id } = await params;
    const body = schema.parse(await req.json());
    const updated = await rescheduleProcedureOrder(id, new Date(body.scheduledAt));
    return jsonOk(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
