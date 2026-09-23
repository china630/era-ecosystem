import { z } from "zod";
import {
  getRouteSession,
  handleRouteError,
  jsonOk,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { getPractitionerDayMatrix } from "@/domain/appointment/appointment-calendar.service";
import { bakuDayBounds, todayBakuYmd } from "@/lib/baku-day";

const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function GET(req: Request) {
  try {
    const session = await getRouteSession();
    const deniedRead = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_APPOINTMENTS_READ,
    );
    if (deniedRead) {
      const deniedWrite = await requireClinicPermission(
        session,
        CLINIC_PERMISSION.API_APPOINTMENTS_WRITE,
      );
      if (deniedWrite) return deniedWrite;
    }

    const url = new URL(req.url);
    const query = querySchema.parse({
      date: url.searchParams.get("date") ?? undefined,
    });
    const dateParam = query.date ?? todayBakuYmd();
    const { start: day } = bakuDayBounds(dateParam);
    const matrix = await getPractitionerDayMatrix(day);
    return jsonOk(matrix);
  } catch (err) {
    return handleRouteError(err);
  }
}
