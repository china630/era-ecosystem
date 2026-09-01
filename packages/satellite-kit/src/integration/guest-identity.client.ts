import {
  defaultGuestIdentityExpiresAt,
  signGuestIdentityToken,
  verifyGuestIdentityToken,
  type GuestIdentityTokenPayload,
} from "../auth/guest-identity-token";
import {
  resolveOrchestratorBaseUrl,
  resolveSatelliteEventServiceToken,
} from "../tenancy/resolve-orchestrator-url";

export type GuestIdentityClientOptions = {
  orchestratorUrl?: string;
  serviceToken?: string;
};

function baseUrl(opts?: GuestIdentityClientOptions): string {
  if (opts?.orchestratorUrl?.trim()) {
    return opts.orchestratorUrl.trim().replace(/\/$/, "");
  }
  return resolveOrchestratorBaseUrl({ fallback: "http://127.0.0.1:4100" });
}

function serviceToken(opts?: GuestIdentityClientOptions): string | undefined {
  return (
    opts?.serviceToken?.trim() ||
    process.env.MDM_INTERNAL_SERVICE_TOKEN?.trim() ||
    resolveSatelliteEventServiceToken() ||
    undefined
  );
}

export async function resolveGlobalPerson(
  input: {
    fin?: string;
    /** Legacy single-line name; MDM splits when parts omitted. */
    fullName?: string;
    firstName?: string;
    middleName?: string;
    lastName?: string;
    phone?: string;
    passport?: string;
    issuingCountry?: string;
    nationality?: string;
  },
  opts?: GuestIdentityClientOptions,
): Promise<{ globalPersonId: string | null }> {
  const { resolvePersonIdentity } = await import("./person-identity.client");
  return resolvePersonIdentity(input, opts);
}

export async function issueGuestQrToken(
  globalPersonId: string,
  opts?: GuestIdentityClientOptions & { ttlSeconds?: number },
): Promise<{ token: string; expiresAt: number } | null> {
  const token = serviceToken(opts);
  if (!token) {
    const expiresAt = defaultGuestIdentityExpiresAt(opts?.ttlSeconds);
    return {
      token: signGuestIdentityToken(globalPersonId, expiresAt),
      expiresAt,
    };
  }
  const res = await fetch(`${baseUrl(opts)}/internal/v1/mdm/guest-qr/issue`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-service-token": token,
    },
    body: JSON.stringify({ globalPersonId, ttlSeconds: opts?.ttlSeconds }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return null;
  return (await res.json()) as { token: string; expiresAt: number };
}

export async function verifyGuestQrToken(
  guestToken: string,
  opts?: GuestIdentityClientOptions,
): Promise<GuestIdentityTokenPayload | null> {
  const svc = serviceToken(opts);
  if (svc) {
    const res = await fetch(`${baseUrl(opts)}/internal/v1/mdm/guest-qr/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-service-token": svc,
      },
      body: JSON.stringify({ token: guestToken }),
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const data = (await res.json()) as GuestIdentityTokenPayload;
      if (data.globalPersonId) return data;
    }
  }
  return verifyGuestIdentityToken(guestToken);
}

export { verifyGuestIdentityToken, signGuestIdentityToken };
