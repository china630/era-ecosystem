import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { resolveSatelliteOrganizationId } from "@era/satellite-kit";
import { authenticateBridgeRequest } from "@/lib/integration/elektraweb-bridge/auth";
import {
  getElektrawebBridgePolicy,
  isElektrawebBridgeEnabled,
  isPolicyWriteEnabled,
} from "@/lib/integration/elektraweb-bridge/config";
import { getBridgeHealth } from "@/lib/integration/elektraweb-bridge/ingest";
import { countOutboxByStatus } from "@/lib/integration/elektraweb-bridge/outbox.service";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return jsonOk({
        enabled: isElektrawebBridgeEnabled(),
        organizationIdConfigured:
          resolveSatelliteOrganizationId({ allowFallback: true }).source !== "fallback",
        policyStore: "ElektrawebBridgePolicy",
      });
    }

    const auth = await authenticateBridgeRequest(request);
    const health = getBridgeHealth();
    const policy = await getElektrawebBridgePolicy(auth.organizationId);
    const outbox = await countOutboxByStatus(auth.organizationId);
    return jsonOk({
      ...health,
      writeEnabled: isPolicyWriteEnabled(policy),
      inboundEnabled: !!policy?.inboundEnabled,
      outbox,
      organizationId: auth.organizationId,
      elektrawebHotelId: auth.elektrawebHotelId,
      policyHotelId: policy?.elektrawebHotelId ?? null,
      authVia: auth.via,
      login: auth.login,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
