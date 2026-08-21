/**
 * Read-only MDM lookups via orchestrator internal API (service token).
 */

import {
  resolveOrchestratorBaseUrl,
  resolveSatelliteEventServiceToken,
} from "../tenancy/resolve-orchestrator-url";

export type MdmLookupOptions = {
  orchestratorUrl?: string;
  serviceToken?: string;
};

function baseUrl(opts?: MdmLookupOptions): string {
  if (opts?.orchestratorUrl?.trim()) {
    return opts.orchestratorUrl.trim().replace(/\/$/, "");
  }
  return resolveOrchestratorBaseUrl({ fallback: "http://127.0.0.1:4100" });
}

function serviceToken(opts?: MdmLookupOptions): string | undefined {
  return (
    opts?.serviceToken?.trim() ||
    process.env.MDM_INTERNAL_SERVICE_TOKEN?.trim() ||
    resolveSatelliteEventServiceToken() ||
    undefined
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

export {
  lookupGlobalPersonByFin,
  resolvePersonIdentity,
  mergePersonRecords,
  linkPersonIdentity,
  listPersonIdentifiers,
  getPersonOpsProfile,
  resolveIdentifierForCompliance,
  isValidAzFin,
  type PersonIdentityInput,
  type MdmClientOptions,
  type PersonIdentifierSummary,
  type PersonOpsProfile,
  type ComplianceIdentityResult,
} from "./person-identity.client";

/**
 * Canonical organization name from the orchestrator control plane (MDM).
 * Satellites should prefer this over local profile/tenant records so the
 * displayed company name is the single source of truth from the orchestrator.
 * Fails soft (returns null) so a control-plane hiccup never breaks the header.
 */
export async function fetchControlPlaneOrganizationName(
  organizationId: string,
  opts?: MdmLookupOptions,
): Promise<string | null> {
  const details = await fetchControlPlaneOrganizationDetails(organizationId, opts);
  return details?.name ?? null;
}

export async function fetchControlPlaneOrganizationDetails(
  organizationId: string,
  opts?: MdmLookupOptions,
): Promise<{ organizationId: string; name: string; taxId: string | null } | null> {
  const id = organizationId?.trim();
  if (!id) return null;
  const token = serviceToken(opts);
  try {
    const res = await fetch(
      `${baseUrl(opts)}/internal/v1/mdm/organizations/${encodeURIComponent(id)}/details`,
      {
        headers: token ? { "x-service-token": token } : {},
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      organizationId?: string;
      name?: string;
      taxId?: string | null;
    };
    if (!data?.name) return null;
    return {
      organizationId: data.organizationId ?? id,
      name: data.name,
      taxId: data.taxId ?? null,
    };
  } catch {
    return null;
  }
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
