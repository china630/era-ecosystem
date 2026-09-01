import { SignJWT, jwtVerify } from "jose";

export type SatelliteSessionPayload = {
  sub: string;
  login: string;
  role: string;
  fullName: string;
  /** User email when known (SSO + local login); used for platform super-admin gates. */
  email?: string;
  organizationId?: string;
  /** All mapped satellite roles (includes primary `role`). */
  roles?: string[];
  isOwner?: boolean;
  /** Finance membership role before satellite mapping. */
  financeRole?: string;
  /** Domain permission codes (industry satellite RBAC; optional). */
  permissions?: string[];
};

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_JWT_SECRET must be set (min 16 chars)");
  }
  return new TextEncoder().encode(secret);
}

export function authCookieName(): string {
  return process.env.AUTH_COOKIE_NAME ?? "era_session";
}

export async function signSatelliteSession(
  payload: SatelliteSessionPayload,
): Promise<string> {
  const claims: Record<string, unknown> = {
    login: payload.login,
    role: payload.role,
    fullName: payload.fullName,
  };
  if (payload.email) claims.email = payload.email;
  if (payload.organizationId) claims.organizationId = payload.organizationId;
  if (payload.roles?.length) claims.roles = payload.roles;
  if (payload.isOwner != null) claims.isOwner = payload.isOwner;
  if (payload.financeRole) claims.financeRole = payload.financeRole;
  if (payload.permissions?.length) claims.permissions = payload.permissions;

  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(getSecret());
}

export async function verifySatelliteSession(
  token: string,
): Promise<SatelliteSessionPayload> {
  const { payload } = await jwtVerify(token, getSecret());
  const sub = payload.sub;
  if (!sub || typeof sub !== "string") throw new Error("Invalid token subject");
  const rolesRaw = payload.roles;
  const roles = Array.isArray(rolesRaw)
    ? rolesRaw.map(String)
    : undefined;
  const permissionsRaw = payload.permissions;
  const permissions = Array.isArray(permissionsRaw)
    ? permissionsRaw.map(String)
    : undefined;
  return {
    sub,
    login: String(payload.login ?? ""),
    role: String(payload.role ?? ""),
    fullName: String(payload.fullName ?? ""),
    email: payload.email ? String(payload.email) : undefined,
    organizationId: payload.organizationId
      ? String(payload.organizationId)
      : undefined,
    roles,
    isOwner: payload.isOwner === true,
    financeRole: payload.financeRole
      ? String(payload.financeRole)
      : undefined,
    permissions,
  };
}
