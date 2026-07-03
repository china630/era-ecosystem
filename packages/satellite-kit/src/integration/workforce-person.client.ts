import type { PersonIdentityInput, MdmClientOptions } from "./person-identity.client";
import { linkPersonIdentity } from "./person-identity.client";

export type WorkforceDisplayRow = {
  globalPersonId: string;
  displayName: string | null;
  finMasked: string | null;
  accessDenied: boolean;
};

export type WorkforceResolveResult = {
  globalPersonId: string;
  created: boolean;
  opsProfile: WorkforceDisplayRow;
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

/** Canonical hire intake: linkPersonIdentity + enforce globalPersonId. */
export async function linkWorkforcePersonIdentity(
  input: PersonIdentityInput,
  opts?: MdmClientOptions & { organizationId: string; purpose?: string },
): Promise<{ globalPersonId: string | null; created?: boolean; masked?: boolean }> {
  if (!opts?.organizationId?.trim()) {
    return { globalPersonId: null };
  }
  const res = await fetch(`${baseUrl(opts)}/internal/v1/mdm/persons/workforce-resolve`, {
    method: "POST",
    headers: authHeaders(serviceToken(opts) ?? ""),
    body: JSON.stringify({
      ...input,
      organizationId: opts.organizationId.trim(),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const linked = await linkPersonIdentity(input, opts);
    return linked;
  }
  const data = (await res.json()) as WorkforceResolveResult;
  return {
    globalPersonId: data.globalPersonId ?? null,
    created: data.created,
  };
}

export async function fetchWorkforcePersonOpsBatch(
  personIds: string[],
  organizationId: string,
  opts?: MdmClientOptions,
): Promise<Record<string, WorkforceDisplayRow>> {
  const token = serviceToken(opts);
  if (!token || !organizationId.trim() || personIds.length === 0) return {};
  const res = await fetch(`${baseUrl(opts)}/internal/v1/mdm/persons/ops-profile/batch`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ personIds, organizationId: organizationId.trim() }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return {};
  const data = (await res.json()) as Record<
    string,
    {
      globalPersonId: string;
      displayName: string | null;
      primaryIdentifierMasked: string | null;
      accessDenied: boolean;
    }
  >;
  const out: Record<string, WorkforceDisplayRow> = {};
  for (const [id, row] of Object.entries(data)) {
    out[id] = buildWorkforceDisplayRow(row);
  }
  return out;
}

export function buildWorkforceDisplayRow(row: {
  globalPersonId: string;
  displayName?: string | null;
  primaryIdentifierMasked?: string | null;
  accessDenied?: boolean;
}): WorkforceDisplayRow {
  return {
    globalPersonId: row.globalPersonId,
    displayName: row.displayName ?? null,
    finMasked: row.primaryIdentifierMasked ?? null,
    accessDenied: Boolean(row.accessDenied),
  };
}
