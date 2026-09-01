import { z } from "zod";
import {
  getRouteSession,
  jsonError,
  jsonOk,
  handleRouteError,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { cancelVisit } from "@/domain/visit/visit.service";

const schema = z.object({ reason: z.string().min(1).max(500) });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_VISITS);
    if (denied) return denied;

    const { id } = await params;
    const body = schema.parse(await request.json());
    const visit = await cancelVisit(id, body.reason, session.sub);
    return jsonOk({ visit });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Cancel failed";
    if (msg.includes("Cannot cancel") || msg.includes("not found")) {
      return jsonError(msg, 400);
    }
    return handleRouteError(err);
  }
}
