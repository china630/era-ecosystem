import { z } from "zod";
import {
  jsonOk,
  handleRouteError,
  getSatelliteSession,
  jsonError,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { getOpsDaySummary } from "@/domain/ops/day-summary.service";

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const querySchema = z.object({
  date: ymd.optional(),
  from: ymd.optional(),
  to: ymd.optional(),
});

export async function GET(req: Request) {
  try {
    const session = await getSatelliteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_OPS_DAY_SUMMARY);
    if (denied) return denied;

    const url = new URL(req.url);
    const parsed = querySchema.parse({
      date: url.searchParams.get("date") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    });
    const locale =
      url.searchParams.get("locale") ??
      req.headers.get("x-era-locale") ??
      "en";

    return jsonOk(
      await getOpsDaySummary(parsed.date, locale, {
        from: parsed.from,
        to: parsed.to,
      }),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
