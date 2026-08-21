import { SignJWT, jwtVerify } from "jose";

export type AgencySessionPayload = {
  sub: string;
  actor: "agency";
  email: string;
  fullName: string;
  organizationId: string;
  agencyId: string;
  agencyCode?: string;
};

function getSessionSecret(): Uint8Array {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_JWT_SECRET must be set (min 16 chars)");
  }
  return new TextEncoder().encode(secret);
}

export function agencyAuthCookieName(): string {
  return process.env.AGENCY_AUTH_COOKIE_NAME ?? "era_agency_session";
}

export async function signAgencySession(
  payload: AgencySessionPayload,
): Promise<string> {
  return new SignJWT({
    actor: "agency",
    email: payload.email,
    fullName: payload.fullName,
    organizationId: payload.organizationId,
    agencyId: payload.agencyId,
    agencyCode: payload.agencyCode,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(getSessionSecret());
}

export async function verifyAgencySession(
  token: string,
): Promise<AgencySessionPayload> {
  const { payload } = await jwtVerify(token, getSessionSecret());
  const sub = payload.sub;
  if (!sub || typeof sub !== "string") throw new Error("Invalid token subject");
  if (payload.actor !== "agency") throw new Error("Not an agency session");
  return {
    sub,
    actor: "agency",
    email: String(payload.email ?? ""),
    fullName: String(payload.fullName ?? ""),
    organizationId: String(payload.organizationId ?? ""),
    agencyId: String(payload.agencyId ?? ""),
    agencyCode: payload.agencyCode ? String(payload.agencyCode) : undefined,
  };
}
