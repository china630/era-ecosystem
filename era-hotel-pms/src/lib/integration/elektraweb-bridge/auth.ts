import { SignJWT, jwtVerify } from "jose";
import {
  enterBridgeTenant,
  getElektrawebBridgePolicy,
  isElektrawebBridgeEnabled,
  isPolicyInboundEnabled,
  requirePolicyHotelId,
  roleMayUseBridge,
} from "@/lib/integration/elektraweb-bridge/config";
import { verifyToken as verifySessionToken, type SessionPayload } from "@/lib/auth/jwt";

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
      if (!roleMayUseBridge(role) && role !== "bridge") {
        throw new Error("Forbidden: insufficient role for Elektraweb bridge");
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
  if (!roleMayUseBridge(session.role)) {
    throw new Error("Forbidden: insufficient role for Elektraweb bridge");
  }
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
