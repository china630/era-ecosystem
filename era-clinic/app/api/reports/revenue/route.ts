import { getSatelliteSession, handleRouteError, jsonError, jsonOk, requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { bakuDayBounds, todayBakuYmd } from "@/lib/baku-day";
import { loadRevenueStatement } from "@/domain/reports/load-revenue-statement";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  try {
    const session = await getSatelliteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_REPORTS_PROCEDURES);
    if (denied) return denied;
    if (!session) return jsonError("Unauthorized", 401);

    const url = new URL(req.url);
    const from = (url.searchParams.get("from") ?? todayBakuYmd()).trim();
    const to = (url.searchParams.get("to") ?? from).trim();
    if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
      return jsonError("from and to must be YYYY-MM-DD", 400);
    }
    const { start } = bakuDayBounds(from);
    const { end } = bakuDayBounds(to);
    const items = await loadRevenueStatement(start, end);
    const grandTotal = Math.round(items.reduce((sum, row) => sum + row.amount, 0) * 100) / 100;
    return jsonOk({ items, grandTotal });
  } catch (err) {
    return handleRouteError(err);
  }
}
