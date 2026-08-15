import { z } from "zod";
import {
  getRouteSession,
  handleRouteError,
  jsonOk,
  requireClinicRole,
} from "@/lib/api-utils";
import { CLINIC_ROLE } from "@/lib/clinic-roles";
import { getPractitionerDayMatrix } from "@/domain/appointment/appointment-calendar.service";

const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function GET(req: Request) {
  try {
    const session = await getRouteSession();
    const denied = requireClinicRole(session, [CLINIC_ROLE.RECEPTION]);
    if (denied) return denied;

    const url = new URL(req.url);
    const query = querySchema.parse({
      date: url.searchParams.get("date") ?? undefined,
    });
    const dateParam = query.date ?? new Date().toISOString().slice(0, 10);
    // Asia/Baku calendar day
    const day = new Date(`${dateParam}T00:00:00+04:00`);
    const matrix = await getPractitionerDayMatrix(day);
    return jsonOk(matrix);
  } catch (err) {
    return handleRouteError(err);
  }
}
