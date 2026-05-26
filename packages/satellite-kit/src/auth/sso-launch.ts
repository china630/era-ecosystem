import { createHmac } from "crypto";
import { buildSsoPayload } from "./sso-verify";

export type SatelliteSsoLaunchParams = {
  email: string;
  fullName: string;
  organizationId: string;
  expiresAt: number;
  financeRole?: string;
};

export function signSatelliteSsoPayload(
  params: Pick<SatelliteSsoLaunchParams, "email" | "organizationId" | "expiresAt">,
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
  const normalized = baseUrl.replace(/\/$/, "");
  const signature = signSatelliteSsoPayload(params, secret);
  const q = new URLSearchParams({
    email: params.email,
    fullName: params.fullName,
    organizationId: params.organizationId,
    expiresAt: String(params.expiresAt),
    signature,
  });
  if (params.financeRole) {
    q.set("financeRole", params.financeRole);
  }
  return `${normalized}/sso/callback?${q.toString()}`;
}
