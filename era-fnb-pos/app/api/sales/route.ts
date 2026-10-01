import { assertFnbEntitled, handleRouteError, jsonOk } from "@/lib/api-utils";
import { getSessionFromRequest } from "@/lib/session";
import { denyUnlessAnyPermission } from "@/lib/auth/require";
import { TILL_READ_TICKETS } from "@/lib/auth/read-permission-sets";
import { saleReportForScope } from "@/lib/sales-report";

export async function GET(request: Request) {
  try {
    await assertFnbEntitled();
    const session = await getSessionFromRequest(request);
    const denied = denyUnlessAnyPermission(session, TILL_READ_TICKETS);
    if (denied) return denied;
    const scope = new URL(request.url).searchParams.get("scope") === "shift" ? "shift" : "today";
    return jsonOk(await saleReportForScope(scope));
  } catch (err) {
    return handleRouteError(err);
  }
}
