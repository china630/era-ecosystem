import {
  jsonOk,
  jsonError,
  handleRouteError,
  getRouteSession,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { assertEpisodeDataScope } from "@/lib/auth/clinic-data-scope";
import { getEpisodeSchedule } from "@/lib/services/sanatorium.service";
import { bakuDateKey, bakuDayBounds, todayBakuYmd } from "@/lib/baku-day";

function parseDayYmd(value: string | null): string {
  if (!value?.trim()) return todayBakuYmd();
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return bakuDateKey(new Date(trimmed));
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_SANATORIUM_EPISODES_READ,
    );
    if (denied) return denied;
    const { id } = await params;
    const scopeDenied = await assertEpisodeDataScope(session, id);
    if (scopeDenied) return scopeDenied;
    const url = new URL(req.url);
    const fromYmd = parseDayYmd(url.searchParams.get("from"));
    const { start: from, end: fromEnd } = bakuDayBounds(fromYmd);
    const toParam = url.searchParams.get("to");
    const to = toParam ? bakuDayBounds(parseDayYmd(toParam)).start : fromEnd;

    const orders = await getEpisodeSchedule(
      id,
      from,
      to,
      url.searchParams.get("locale") ?? req.headers.get("x-era-locale") ?? "en",
    );
    return jsonOk(orders);
  } catch (err) {
    return handleRouteError(err);
  }
}
