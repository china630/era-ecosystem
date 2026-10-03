import { assertFnbEntitled, handleRouteError, jsonOk } from "@/lib/api-utils";
import { getSessionFromRequest } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { saleReportForScope } from "@/lib/sales-report";

export async function GET(request: Request) {
  try {
    await assertFnbEntitled();
    const session = await getSessionFromRequest(request);
    const denied = denyUnlessPermission(session, PERMISSIONS.SCREEN_SALES);
    if (denied) return denied;
    const url = new URL(request.url);
    const scope = url.searchParams.get("scope") === "shift" ? "shift" : "today";
    const channelRaw = url.searchParams.get("channel");
    const methodRaw = url.searchParams.get("method");
    const channel = channelRaw === "TAKEAWAY" || channelRaw === "DINE_IN" ? channelRaw : undefined;
    const method =
      methodRaw === "CASH" || methodRaw === "CARD" || methodRaw === "TRANSFER" ? methodRaw : undefined;
    const date = url.searchParams.get("date") ?? undefined;
    const shiftId = url.searchParams.get("shiftId") ?? undefined;
    return jsonOk(await saleReportForScope(scope, { date, channel, method, shiftId }));
  } catch (err) {
    return handleRouteError(err);
  }
}
