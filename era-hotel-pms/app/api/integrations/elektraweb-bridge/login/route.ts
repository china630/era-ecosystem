import {
  ORG_NO_RE,
  burnPasswordVerifyCost,
  readStaffLoginJson,
  resolveStaffLoginTenant,
  satelliteRuntimeConfig,
} from "@era/satellite-kit";
import { z } from "zod";
import { jsonOk, handleRouteError, jsonError } from "@/lib/api-utils";
import { verifyPassword } from "@/lib/auth/password";
import { getUserByLogin } from "@/lib/services/user.service";
import { signBridgeToken } from "@/lib/integration/elektraweb-bridge/auth";
import {
  enterBridgeTenant,
  getElektrawebBridgePolicy,
  isElektrawebBridgeEnabled,
  isPolicyInboundEnabled,
  requirePolicyHotelId,
} from "@/lib/integration/elektraweb-bridge/config";
import { sessionMayUseBridge } from "@/lib/integration/elektraweb-bridge/grants";
import { effectiveRolePermissions } from "@/lib/auth/permissions";

const schema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
  /** Required on SHARED pool; appliance may omit (process bind). */
  orgNo: z.string().regex(ORG_NO_RE).optional(),
});

/**
 * Extension login → bridge JWT bound to the chosen ERA hotel org + policy hotel id.
 */
export async function POST(request: Request) {
  try {
    if (!isElektrawebBridgeEnabled()) {
      return jsonError("Elektraweb bridge is disabled", 503);
    }

    const rawBody = await readStaffLoginJson(request);
    if (!rawBody.ok) {
      return jsonError(rawBody.error, rawBody.status);
    }
    const body = schema.parse(rawBody.raw);
    const tenant = await resolveStaffLoginTenant({
      orgNo: body.orgNo,
      isShared: satelliteRuntimeConfig().deploymentTopology === "SHARED",
      request,
    });
    if (!tenant.ok) {
      return jsonError(tenant.error, tenant.status);
    }
    const user = await getUserByLogin(body.login, tenant.organizationId);
    if (!user || user.status !== "ACTIVE") {
      await burnPasswordVerifyCost(body.password);
      return jsonError("Invalid credentials", 401);
    }
    const valid = await verifyPassword(body.password, user.passwordHash);
    if (!valid) return jsonError("Invalid credentials", 401);

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
      return jsonError("Forbidden: missing api:integration.elektraweb_bridge", 403);
    }

    const organizationId = user.organizationId;
    const policy = await getElektrawebBridgePolicy(organizationId);
    if (!isPolicyInboundEnabled(policy) || !policy) {
      return jsonError("Elektraweb bridge inbound is off for this organization", 403);
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

    return jsonOk({
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
  } catch (err) {
    return handleRouteError(err);
  }
}
