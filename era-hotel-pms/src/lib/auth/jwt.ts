import { SignJWT, jwtVerify } from "jose";

export interface SessionPayload {
  sub: string;
  login: string;
  role: string;
  fullName: string;
  /** When known (login/SSO) — platform super-admin allowlist matches email. */
  email?: string;
  /** ERA hotel org for this session (SHARED request tenant). */
  organizationId?: string;
  /** Role grants snapshot for page middleware; API reloads from DB in getSessionFromHeaders. */
  permissions?: string[];
  /** Org owner — bypasses permission matrix (not Hotel_Admin). */
  isOwner?: boolean;
}

function getSecret() {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_JWT_SECRET must be set (min 16 chars)");
  }
  return new TextEncoder().encode(secret);
}

export async function signToken(payload: SessionPayload): Promise<string> {
  const claims: Record<string, unknown> = {
    login: payload.login,
    role: payload.role,
    fullName: payload.fullName,
  };
  if (payload.email) claims.email = payload.email;
  if (payload.organizationId) claims.organizationId = payload.organizationId;
  if (payload.permissions?.length) claims.permissions = payload.permissions;
  if (payload.isOwner === true) claims.isOwner = true;

  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<SessionPayload> {
  const { payload } = await jwtVerify(token, getSecret());
  const sub = payload.sub;
  if (!sub || typeof sub !== "string") throw new Error("Invalid token subject");
  const permissionsRaw = payload.permissions;
  const permissions = Array.isArray(permissionsRaw)
    ? permissionsRaw.map(String)
    : undefined;
  return {
    sub,
    login: String(payload.login ?? ""),
    role: String(payload.role ?? ""),
    fullName: String(payload.fullName ?? ""),
    email: payload.email != null ? String(payload.email) : undefined,
    organizationId:
      payload.organizationId != null ? String(payload.organizationId) : undefined,
    permissions,
    isOwner: payload.isOwner === true,
  };
}
