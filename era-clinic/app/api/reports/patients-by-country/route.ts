import { z } from "zod";
import {
  getSatelliteSession,
  handleRouteError,
  jsonError,
  jsonOk,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { patientsByCountryReport } from "@/domain/reports/patients-by-country.service";
import { billingPeriodKeyBaku } from "@era/satellite-kit/time";

const querySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  origin: z.enum(["IN_HOUSE", "WALK_IN"]).optional(),
});

export async function GET(req: Request) {
  try {
    const session = await getSatelliteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_REPORTS_DIAGNOSES);
    if (denied) return denied;
    if (!session?.organizationId) return jsonError("Unauthorized", 401);

    const url = new URL(req.url);
    const query = querySchema.parse({
      month: url.searchParams.get("month") ?? undefined,
      origin: url.searchParams.get("origin") ?? undefined,
    });
    const report = await patientsByCountryReport({
      organizationId: session.organizationId,
      periodKey: query.month ?? billingPeriodKeyBaku(),
      origin: query.origin ?? "IN_HOUSE",
    });
    const totals = report.items.reduce(
      (sum, row) => ({
        guests: sum.guests + row.guests,
        nights: sum.nights + row.nights,
        extras: sum.extras + row.extras,
      }),
      { guests: 0, nights: 0, extras: 0 },
    );
    return jsonOk({ ...report, totals });
  } catch (err) {
    return handleRouteError(err);
  }
}
