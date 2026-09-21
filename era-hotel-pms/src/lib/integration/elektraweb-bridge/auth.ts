import { SignJWT, jwtVerify } from "jose";
import {
  enterBridgeTenant,
  getElektrawebBridgePolicy,
  isElektrawebBridgeEnabled,
  isPolicyInboundEnabled,
  requirePolicyHotelId,
} from "@/lib/integration/elektraweb-bridge/config";
import {
  isElektrawebBridgeS2SRole,
  sessionMayUseBridge,
} from "@/lib/integration/elektraweb-bridge/grants";
import { verifyToken as verifySessionToken, type SessionPayload } from "@/lib/auth/jwt";
import { prisma } from "@/lib/prisma";
import { effectiveRolePermissions } from "@/lib/auth/permissions";

const PURPOSE = "elektraweb-bridge";

export type BridgeAuthContext = {
  organizationId: string;
  elektrawebHotelId: number;
  login: string;
  role: string;
  userId?: string;
  via: "bridge_jwt" | "session_jwt";
};

function getSecret() {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_JWT_SECRET must be set (min 16 chars)");
  }
  return new TextEncoder().encode(secret);
}

export async function signBridgeToken(input: {
  userId: string;
  login: string;
  role: string;
  fullName: string;
  organizationId: string;
  elektrawebHotelId: number;
}): Promise<string> {
  return new SignJWT({
    purpose: PURPOSE,
    login: input.login,
    role: input.role,
    fullName: input.fullName,
    organizationId: input.organizationId,
    elektrawebHotelId: input.elektrawebHotelId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(input.userId)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(getSecret());
}

function bearer(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7).trim() || null;
}

export async function authenticateBridgeRequest(request: Request): Promise<BridgeAuthContext> {
  if (!isElektrawebBridgeEnabled()) {
    throw new Error("Elektraweb bridge is disabled (ELEKTRAWEB_BRIDGE_ENABLED≠1)");
  }

  const token = bearer(request);
  if (!token) throw new Error("Unauthorized");

  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.purpose === PURPOSE) {
      const organizationId = String(payload.organizationId ?? "");
      const hotelId = Number(payload.elektrawebHotelId);
      if (!organizationId) throw new Error("Forbidden: bridge token missing organizationId");
      const policy = await getElektrawebBridgePolicy(organizationId);
      if (!isPolicyInboundEnabled(policy) || !policy) {
        throw new Error("Forbidden: Elektraweb bridge inbound is off for this organization");
      }
      const expectedHotelId = requirePolicyHotelId(policy);
      if (hotelId !== expectedHotelId) {
        throw new Error(
          `Forbidden: bridge token hotel ${hotelId} does not match policy ${expectedHotelId}`,
        );
      }
      const role = String(payload.role ?? "");
      const userId = typeof payload.sub === "string" ? payload.sub : undefined;
      // S2S: role===bridge skips matrix. Staff tokens re-check DB grants (revoke-safe).
      if (!isElektrawebBridgeS2SRole(role)) {
        await assertStaffBridgeGrantFromDb({
          userId,
          fallbackLogin: String(payload.login ?? ""),
        });
      }
      enterBridgeTenant(organizationId);
      return {
        organizationId,
        elektrawebHotelId: expectedHotelId,
        login: String(payload.login ?? ""),
        role,
        userId: typeof payload.sub === "string" ? payload.sub : undefined,
        via: "bridge_jwt",
      };
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Forbidden")) throw err;
    if (err instanceof Error && err.message === "Unauthorized") throw err;
    if (err instanceof Error && err.message.includes("not configured")) throw err;
    if (err instanceof Error && err.message.includes("inbound is off")) throw err;
    // fall through to session JWT
  }

  let session: SessionPayload;
  try {
    session = await verifySessionToken(token);
  } catch {
    throw new Error("Unauthorized");
  }
  await assertStaffBridgeGrantFromDb({
    userId: session.sub,
    fallbackLogin: session.login,
    isOwner: session.isOwner,
  });
  const organizationId = session.organizationId;
  if (!organizationId) {
    throw new Error("Forbidden: session missing organizationId — re-login with org");
  }
  const policy = await getElektrawebBridgePolicy(organizationId);
  if (!isPolicyInboundEnabled(policy) || !policy) {
    throw new Error("Forbidden: Elektraweb bridge inbound is off for this organization");
  }
  enterBridgeTenant(organizationId);
  return {
    organizationId,
    elektrawebHotelId: requirePolicyHotelId(policy),
    login: session.login,
    role: session.role,
    userId: session.sub,
    via: "session_jwt",
  };
}

async function assertStaffBridgeGrantFromDb(input: {
  userId?: string;
  fallbackLogin: string;
  isOwner?: boolean;
}): Promise<void> {
  if (!input.userId?.trim()) {
    throw new Error("Forbidden: insufficient grant for Elektraweb bridge");
  }
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      status: true,
      login: true,
      email: true,
      role: { select: { code: true, permissionsJson: true } },
    },
  });
  if (!user || user.status !== "ACTIVE") {
    throw new Error("Unauthorized");
  }
  const permissions = effectiveRolePermissions(
    user.role.code,
    user.role.permissionsJson,
  );
  if (
    !sessionMayUseBridge({
      login: user.login || input.fallbackLogin,
      email: user.email ?? undefined,
      role: user.role.code,
      permissions,
      isOwner: input.isOwner === true || user.role.code === "BUSINESS_OWNER",
    })
  ) {
    throw new Error("Forbidden: insufficient grant for Elektraweb bridge");
  }
}
