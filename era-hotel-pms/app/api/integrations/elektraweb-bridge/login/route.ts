import {
  authenticateIndustryStaffLogin,
  satelliteRuntimeConfig,
} from "@era/satellite-kit";
import { jsonOk, handleRouteError, jsonError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
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

/**
 * Extension login → bridge JWT bound to the chosen ERA hotel org + policy hotel id.
 */
export async function POST(request: Request) {
  try {
    if (!isElektrawebBridgeEnabled()) {
      return jsonError("Elektraweb bridge is disabled", 503);
    }

    const auth = await authenticateIndustryStaffLogin({
      request,
      prisma,
      isShared: satelliteRuntimeConfig().deploymentTopology === "SHARED",
    });
    if (!auth.ok) {
      return jsonError(auth.error, auth.status);
    }
    const user = await prisma.user.findUnique({
      where: { id: auth.user.id },
      include: { role: true },
    });
    if (!user || user.status !== "ACTIVE") {
      return jsonError("Invalid credentials", 401);
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
