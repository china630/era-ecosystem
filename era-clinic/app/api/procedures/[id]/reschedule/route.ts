import { z } from "zod";
import {
  jsonOk,
  jsonError,
  handleRouteError,
  getRouteSession,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { receptionRescheduleProcedure } from "@/domain/procedure/procedure-attendance.service";
import { evaluateAndPublishCapacity } from "@/lib/capacity.service";

const schema = z.object({
  scheduledAt: z.string().datetime(),
  resourceId: z.string().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PROCEDURES_RECEPTION);
    if (denied) return denied;

    const { id } = await params;
    const body = schema.parse(await req.json());
    const updated = await receptionRescheduleProcedure(
      id,
      new Date(body.scheduledAt),
      { userId: session!.sub, canOverrideCheckIn: false },
      { resourceId: body.resourceId },
    );
    void evaluateAndPublishCapacity().catch(() => null);
    return jsonOk(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
