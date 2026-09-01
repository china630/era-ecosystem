import { z } from "zod";
import {
  jsonOk,
  handleRouteError,
  getRouteSession,
  jsonError,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { getOpsDaySummary } from "@/domain/ops/day-summary.service";

const querySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export async function GET(req: Request) {
  try {
    const session = await getRouteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_OPS_DAY_SUMMARY);
    if (denied) return denied;

        const url = new URL(req.url);
    const parsed = querySchema.parse({
      date: url.searchParams.get("date") ?? undefined,
    });
    const locale =
      url.searchParams.get("locale") ??
      req.headers.get("x-era-locale") ??
      "en";

    return jsonOk(await getOpsDaySummary(parsed.date, locale));
  } catch (err) {
    return handleRouteError(err);
  }
}
