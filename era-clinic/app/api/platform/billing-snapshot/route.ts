import { jsonOk, jsonError, handleRouteError, getRouteSession } from "@/lib/api-utils";
import { getSubscriptionMe } from "@/integration/control-plane-platform.client";

export async function GET() {
  try {
    const session = await getRouteSession();
    if (!session?.organizationId?.trim()) {
      return jsonOk({
        skipped: true,
        reason: "session organizationId required",
      });
    }
    const organizationId = session.organizationId.trim();
    const snapshot = await getSubscriptionMe({ organizationId });
    return jsonOk(snapshot);
  } catch (err) {
    return handleRouteError(err);
  }
}
