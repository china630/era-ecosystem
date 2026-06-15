/**
 * MDM person identity — resolve / lookup with multi-identifier support.
 */

export type PersonIdentityInput = {
  fin?: string;
  passport?: string;
  issuingCountry?: string;
  residencePermit?: string;
  nationalId?: string;
  fullName: string;
  phone?: string;
  nationality?: string;
};

export type MdmClientOptions = {
  orchestratorUrl?: string;
  serviceToken?: string;
};

function baseUrl(opts?: MdmClientOptions): string {
  return (
    opts?.orchestratorUrl ??
    process.env.ORCHESTRATOR_URL ??
    process.env.CONTROL_PLANE_URL ??
    "http://127.0.0.1:4100"
  ).replace(/\/$/, "");
}

function serviceToken(opts?: MdmClientOptions): string | undefined {
  return (
    opts?.serviceToken ??
    process.env.MDM_INTERNAL_SERVICE_TOKEN ??
    process.env.SATELLITE_EVENT_SERVICE_TOKEN
  );
}

function authHeaders(token: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "x-service-token": token,
  };
}

/** Read-only FIN lookup (consent-aware). */
export async function lookupGlobalPersonByFin(
  fin: string,
  opts?: MdmClientOptions & { requesterOrgId?: string; purpose?: string },
): Promise<{ globalPersonId: string | null; masked?: boolean }> {
  const token = serviceToken(opts);
  if (!token) return { globalPersonId: null };
  const res = await fetch(`${baseUrl(opts)}/internal/v1/mdm/persons/lookup-by-fin`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      fin: fin.trim(),
      requesterOrgId: opts?.requesterOrgId,
      purpose: opts?.purpose ?? "lookup",
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return { globalPersonId: null };
  const data = (await res.json()) as {
    found?: boolean;
    globalPersonId?: string;
    masked?: boolean;
  };
  if (!data.found || !data.globalPersonId) return { globalPersonId: null };
  return { globalPersonId: data.globalPersonId, masked: data.masked };
}

/** Resolve or create person by FIN / passport / residence permit. */
export async function resolvePersonIdentity(
  input: PersonIdentityInput,
  opts?: MdmClientOptions,
): Promise<{ globalPersonId: string | null }> {
  const token = serviceToken(opts);
  if (!token) return { globalPersonId: null };
  const res = await fetch(`${baseUrl(opts)}/internal/v1/mdm/persons/resolve`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return { globalPersonId: null };
  const data = (await res.json()) as { id?: string; globalPersonId?: string };
  return { globalPersonId: data.globalPersonId ?? data.id ?? null };
}

/** AZ FIN: 7 chars, no I/O. */
export function isValidAzFin(fin: string): boolean {
  return /^[0-9A-HJ-NP-Za-hj-np-z]{7}$/.test(fin.trim());
}

/** Canonical: lookup FIN → else resolve-or-create. */
export async function linkPersonIdentity(
  input: PersonIdentityInput,
  opts?: MdmClientOptions & { requesterOrgId?: string; purpose?: string },
): Promise<{ globalPersonId: string | null; created?: boolean; masked?: boolean }> {
  if (!input.fullName?.trim()) {
    return { globalPersonId: null };
  }
  if (input.fin?.trim()) {
    const lookup = await lookupGlobalPersonByFin(input.fin.trim(), opts);
    if (lookup.globalPersonId) {
      return { globalPersonId: lookup.globalPersonId, masked: lookup.masked };
    }
  }
  const resolved = await resolvePersonIdentity(input, opts);
  return {
    globalPersonId: resolved.globalPersonId,
    created: Boolean(resolved.globalPersonId),
  };
}

/** Merge foreigner record into citizen record when FIN is obtained. */
export async function mergePersonRecords(
  sourcePersonId: string,
  targetPersonId: string,
  opts?: MdmClientOptions & { actorOrgId?: string },
): Promise<{ globalPersonId: string | null }> {
  const token = serviceToken(opts);
  if (!token) return { globalPersonId: null };
  const res = await fetch(`${baseUrl(opts)}/internal/v1/mdm/persons/merge`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      sourcePersonId,
      targetPersonId,
      actorOrgId: opts?.actorOrgId,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return { globalPersonId: null };
  const data = (await res.json()) as { globalPersonId?: string };
  return { globalPersonId: data.globalPersonId ?? null };
}
