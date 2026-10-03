import { handleRouteError, jsonOk } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requestOrganizationId } from "@/lib/request-organization";
import { voidEmptyOpenTickets } from "@/lib/ticket-helpers";

/** One-shot cleanup of open checks that have no live lines. */
export async function POST(request: Request) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.TICKETS_OPEN);
    if (denied) return denied;
    const voided = await voidEmptyOpenTickets(requestOrganizationId());
    return jsonOk({ voided });
  } catch (err) {
    return handleRouteError(err);
  }
}
