/**
 * Read-only MDM lookups via orchestrator internal API (service token).
 */

export type MdmLookupOptions = {
  orchestratorUrl?: string;
  serviceToken?: string;
};

function baseUrl(opts?: MdmLookupOptions): string {
  return (
    opts?.orchestratorUrl ??
    process.env.ORCHESTRATOR_URL ??
    process.env.CONTROL_PLANE_URL ??
    "http://127.0.0.1:4100"
  ).replace(/\/$/, "");
}

function serviceToken(opts?: MdmLookupOptions): string | undefined {
  return (
    opts?.serviceToken ??
    process.env.MDM_INTERNAL_SERVICE_TOKEN ??
    process.env.SATELLITE_EVENT_SERVICE_TOKEN
  );
}

export async function mdmHealthCheck(
  opts?: MdmLookupOptions,
): Promise<{ ok: boolean; status?: number }> {
  const token = serviceToken(opts);
  const res = await fetch(`${baseUrl(opts)}/internal/v1/mdm/health`, {
    headers: token ? { "x-service-token": token } : {},
    signal: AbortSignal.timeout(8000),
  });
  return { ok: res.ok, status: res.status };
}

/** Resolve global person id for hotel/clinic guest linkage (Phase 1 stub). */
export async function lookupGlobalPersonByFin(
  fin: string,
  opts?: MdmLookupOptions,
): Promise<{ globalPersonId: string | null }> {
  const token = serviceToken(opts);
  if (!token) return { globalPersonId: null };
  const res = await fetch(`${baseUrl(opts)}/internal/v1/mdm/persons`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-service-token": token,
    },
    body: JSON.stringify({ fin, fullName: "lookup" }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return { globalPersonId: null };
  const data = (await res.json()) as { id?: string; globalPersonId?: string };
  return { globalPersonId: data.globalPersonId ?? data.id ?? null };
}

/** Resolve legal entity by VÖEN (B2B invoicing party). */
export async function lookupLegalEntityByVoen(
  taxId: string,
  opts?: MdmLookupOptions,
): Promise<{ organizationId: string | null; globalLegalEntityId: string | null }> {
  const token = serviceToken(opts);
  if (!token) return { organizationId: null, globalLegalEntityId: null };
  const res = await fetch(
    `${baseUrl(opts)}/internal/v1/mdm/organizations/lookup-by-voen`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-service-token": token,
      },
      body: JSON.stringify({ taxId: taxId.trim() }),
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!res.ok) return { organizationId: null, globalLegalEntityId: null };
  const data = (await res.json()) as {
    organizationId?: string;
    globalLegalEntityId?: string;
  };
  return {
    organizationId: data.organizationId ?? null,
    globalLegalEntityId: data.globalLegalEntityId ?? null,
  };
}
