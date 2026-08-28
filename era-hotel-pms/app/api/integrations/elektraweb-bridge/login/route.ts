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
  roleMayUseBridge,
} from "@/lib/integration/elektraweb-bridge/config";
import { satelliteRuntimeConfig } from "@era/satellite-kit";

const schema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
  /** Required on SHARED pool; appliance may omit (process bind). */
  organizationId: z.string().uuid().optional(),
});

/**
 * Extension login → bridge JWT bound to the chosen ERA hotel org + policy hotel id.
 */
export async function POST(request: Request) {
  try {
    if (!isElektrawebBridgeEnabled()) {
      return jsonError("Elektraweb bridge is disabled", 503);
    }

    const body = schema.parse(await request.json());
    if (
      satelliteRuntimeConfig().deploymentTopology === "SHARED" &&
      !body.organizationId?.trim()
    ) {
      return jsonError("organizationId is required on SHARED pool", 400);
    }
    const user = await getUserByLogin(body.login, body.organizationId);
    if (!user || user.status !== "ACTIVE") {
      return jsonError("Invalid credentials", 401);
    }
    const valid = await verifyPassword(body.password, user.passwordHash);
    if (!valid) return jsonError("Invalid credentials", 401);

    const role = user.role.code;
    if (!roleMayUseBridge(role)) {
      return jsonError("Forbidden: role cannot use Elektraweb bridge", 403);
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
