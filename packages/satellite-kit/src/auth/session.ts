import { SignJWT, jwtVerify } from "jose";

export type SatelliteSessionPayload = {
  sub: string;
  login: string;
  role: string;
  fullName: string;
  organizationId?: string;
  /** All mapped satellite roles (includes primary `role`). */
  roles?: string[];
  isOwner?: boolean;
  /** Finance membership role before satellite mapping. */
  financeRole?: string;
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
  if (payload.organizationId) claims.organizationId = payload.organizationId;
  if (payload.roles?.length) claims.roles = payload.roles;
  if (payload.isOwner != null) claims.isOwner = payload.isOwner;
  if (payload.financeRole) claims.financeRole = payload.financeRole;

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
  return {
    sub,
    login: String(payload.login ?? ""),
    role: String(payload.role ?? ""),
    fullName: String(payload.fullName ?? ""),
    organizationId: payload.organizationId
      ? String(payload.organizationId)
      : undefined,
    roles,
    isOwner: payload.isOwner === true,
    financeRole: payload.financeRole
      ? String(payload.financeRole)
      : undefined,
  };
}
