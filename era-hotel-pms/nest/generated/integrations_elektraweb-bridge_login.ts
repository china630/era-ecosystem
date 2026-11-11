import { signBridgeToken } from "@/lib/integration/elektraweb-bridge/auth";
import { authenticateElektrawebBridgeStaff, loadActiveUserWithRole } from "@/lib/integration/elektraweb-bridge/login.service";
import { enterBridgeTenant, getElektrawebBridgePolicy, isElektrawebBridgeEnabled, isPolicyInboundEnabled, requirePolicyHotelId } from "@/lib/integration/elektraweb-bridge/config";
import { sessionMayUseBridge } from "@/lib/integration/elektraweb-bridge/grants";
import { effectiveRolePermissions } from "@/lib/auth/permissions";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

/**
 * Extension login → bridge JWT bound to the chosen ERA hotel org + policy hotel id.
 */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/integrations/elektraweb-bridge/login", async (httpReq, httpRes) => {
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

  
    if (!isElektrawebBridgeEnabled()) {
      return sendJson(httpRes, { error: "Elektraweb bridge is disabled" }, 503);
    }

    const auth = await authenticateElektrawebBridgeStaff(request);
    if (!auth.ok) {
      return sendJson(httpRes, { error: auth.error }, auth.status);
    }
    const user = await loadActiveUserWithRole(auth.user.id);
    if (!user || user.status !== "ACTIVE") {
      return sendJson(httpRes, { error: "Invalid credentials" }, 401);
    }

    const role = user.role.code;
    const permissions = effectiveRolePermissions(
      role,
      user.role.permissionsJson,
    );
    if (
      !sessionMayUseBridge({
        login: user.login,
        email: user.email ?? undefined,
        role,
        permissions,
        isOwner: role === "BUSINESS_OWNER",
      })
    ) {
      return sendJson(httpRes, { error: "Forbidden: missing api:integration.elektraweb_bridge" }, 403);
    }

    const organizationId = user.organizationId;
    const policy = await getElektrawebBridgePolicy(organizationId);
    if (!isPolicyInboundEnabled(policy) || !policy) {
      return sendJson(httpRes, { error: "Elektraweb bridge inbound is off for this organization" }, 403);
    }
    const elektrawebHotelId = requirePolicyHotelId(policy);
    enterBridgeTenant(organizationId);

    const token = await signBridgeToken({
      userId: user.id,
      login: user.login,
      role,
      fullName: user.fullName,
      organizationId,
      elektrawebHotelId,
    });

    return sendJson(httpRes, {
      token,
      organizationId,
      elektrawebHotelId,
      user: {
        login: user.login,
        fullName: user.fullName,
        role,
      },
      expiresInHours: 12,
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
