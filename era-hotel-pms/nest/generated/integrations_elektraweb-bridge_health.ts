import { isFolkloreS2sToken, resolveSatelliteEventServiceToken, resolveSatelliteOrganizationId } from "@era/satellite-kit";
import { authenticateBridgeRequest } from "@/lib/integration/elektraweb-bridge/auth";
import { getElektrawebBridgePolicy, isElektrawebBridgeEnabled, isPolicyWriteEnabled } from "@/lib/integration/elektraweb-bridge/config";
import { getBridgeHealth } from "@/lib/integration/elektraweb-bridge/ingest";
import { countOutboxByStatus } from "@/lib/integration/elektraweb-bridge/outbox.service";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/integrations/elektraweb-bridge/health", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return sendJson(httpRes, {
        enabled: isElektrawebBridgeEnabled(),
        organizationIdConfigured:
          resolveSatelliteOrganizationId({ allowFallback: true }).source !== "fallback",
        policyStore: "ElektrawebBridgePolicy",
        satelliteEventTokenFolklore: isFolkloreS2sToken(
          resolveSatelliteEventServiceToken(),
        ),
      });
    }

    const auth = await authenticateBridgeRequest(request);
    const health = getBridgeHealth();
    const policy = await getElektrawebBridgePolicy(auth.organizationId);
    const outbox = await countOutboxByStatus(auth.organizationId);
    return sendJson(httpRes, {
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
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
