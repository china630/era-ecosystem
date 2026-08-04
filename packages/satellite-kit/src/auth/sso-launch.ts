import { createHmac } from "crypto";
import { buildSsoPayload } from "./sso-verify";

export type SatelliteSsoLaunchParams = {
  email: string;
  fullName: string;
  organizationId: string;
  expiresAt: number;
  financeRole?: string;
  /** SEC-SSO-01 one-time ticket id (HMAC v3). */
  jti?: string;
};

export function signSatelliteSsoPayload(
  params: Pick<
    SatelliteSsoLaunchParams,
    "email" | "organizationId" | "expiresAt" | "financeRole"
  >,
  secret?: string,
): string {
  const key = secret ?? process.env.ERA_SSO_SHARED_SECRET;
  if (!key) {
    throw new Error("ERA_SSO_SHARED_SECRET is not configured");
  }
  const payload = buildSsoPayload(
    params.email,
    params.organizationId,
    params.expiresAt,
    params.financeRole ?? "USER",
    params.jti,
  );
  return createHmac("sha256", key).update(payload).digest("hex");
}

/** Default SSO ticket TTL: 5 minutes from now (unix seconds). */
export function defaultSsoExpiresAt(ttlSeconds = 300): number {
  return Math.floor(Date.now() / 1000) + ttlSeconds;
}

export function buildSatelliteSsoLaunchUrl(
  baseUrl: string,
  params: SatelliteSsoLaunchParams,
  secret?: string,
): string {
  const signature = signSatelliteSsoPayload(params, secret);
  return buildSatelliteSsoLaunchUrlFromTicket(baseUrl, { ...params, signature });
}

/**
 * Signed SSO launch ticket minted server-side by the orchestrator API.
 * The HMAC secret (`ERA_SSO_SHARED_SECRET`) must never reach the browser, so the
 * launcher requests this ticket from the API and only assembles the URL client-side.
 */
export type SatelliteSsoTicket = SatelliteSsoLaunchParams & { signature: string };

/** Assemble the satellite `/sso/callback` URL from a pre-signed ticket (no crypto). */
export function buildSatelliteSsoLaunchUrlFromTicket(
  baseUrl: string,
  ticket: SatelliteSsoTicket,
): string {
  const normalized = baseUrl.replace(/\/$/, "");
  const q = new URLSearchParams({
    email: ticket.email,
    fullName: ticket.fullName,
    organizationId: ticket.organizationId,
    expiresAt: String(ticket.expiresAt),
    signature: ticket.signature,
  });
  if (ticket.financeRole) {
    q.set("financeRole", ticket.financeRole);
  }
  if (ticket.jti) {
    q.set("jti", ticket.jti);
  }
  return `${normalized}/sso/callback?${q.toString()}`;
}
