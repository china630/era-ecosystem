import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requestOrganizationId } from "@/lib/request-organization";
import { fetchWorkforcePicker } from "@/lib/duty-schedules/picker";

export async function GET() {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const orgId = requestOrganizationId();
    const picker = await fetchWorkforcePicker(orgId);
    const items = picker.items.map((item) => ({
      id: item.id,
      globalPersonId: item.globalPersonId,
      name: item.name,
      orgUnitId: item.orgUnitId,
      orgUnitName: item.orgUnitName,
      positionId: item.positionId,
      positionName: item.positionName,
    }));
    return jsonOk({ items, unavailable: picker.unavailable });
  } catch (err) {
    return handleRouteError(err);
  }
}
