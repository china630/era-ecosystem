import { jsonOk, handleRouteError, getRouteSession, requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { getResourceDayMatrix } from "@/domain/procedure/procedure-inventory.service";
import { bakuDayBounds, todayBakuYmd } from "@/lib/baku-day";

export async function GET(request: Request) {
  try {
    const session = await getRouteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_SANATORIUM_RESOURCES);
    if (denied) return denied;

    const url = new URL(request.url);
    const dateParam = url.searchParams.get("date") ?? todayBakuYmd();
    const { start: date } = bakuDayBounds(dateParam);
    return jsonOk(await getResourceDayMatrix(date));
  } catch (err) {
    return handleRouteError(err);
  }
}
