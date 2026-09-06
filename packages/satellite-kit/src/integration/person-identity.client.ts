/**
 * MDM person identity — resolve / lookup with multi-identifier support.
 */

import { resolveSatelliteOrganizationId } from "../tenancy/organization-bind-core";
import {
  resolveOrchestratorBaseUrl,
  resolveSatelliteEventServiceToken,
} from "../tenancy/resolve-orchestrator-url";
import type { PersonSex } from "./person-sex";
import { normalizePersonSex, toBirthDateIso } from "./person-sex";
import {
  composePersonFullName,
  hasPersonNameInput,
} from "./person-name";

export type PersonIdentityInput = {
  fin?: string;
  passport?: string;
  issuingCountry?: string;
  residencePermit?: string;
  nationalId?: string;
  /** Legacy blob. Prefer firstName + lastName (+ middleName). */
  fullName?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  phone?: string;
  nationality?: string;
  /** When set, resolve updates this person (fill sex/DOB) instead of creating a surrogate. */
  globalPersonId?: string;
  sex?: PersonSex | string;
  /** Hotel ops cache uses `gender` (M/F); mapped to sex on the wire. */
  gender?: string;
  /** Calendar date YYYY-MM-DD or Date. */
  birthDate?: string | Date | null;
};

export type MdmClientOptions = {
  orchestratorUrl?: string;
  serviceToken?: string;
};

function baseUrl(opts?: MdmClientOptions): string {
  if (opts?.orchestratorUrl?.trim()) {
    return opts.orchestratorUrl.trim().replace(/\/$/, "");
  }
  return resolveOrchestratorBaseUrl({ fallback: "http://127.0.0.1:4100" });
}

function serviceToken(opts?: MdmClientOptions): string | undefined {
  const fromEnv =
    process.env.MDM_INTERNAL_SERVICE_TOKEN?.trim() ||
    process.env.ORCHESTRATOR_INTERNAL_SERVICE_TOKEN?.trim() ||
    process.env.CONTROL_PLANE_SERVICE_TOKEN?.trim() ||
    resolveSatelliteEventServiceToken();
  return opts?.serviceToken?.trim() || fromEnv || undefined;
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
): Promise<{
  globalPersonId: string | null;
  masked?: boolean;
  fullName?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
}> {
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
    fullName?: string | null;
    firstName?: string | null;
    middleName?: string | null;
    lastName?: string | null;
  };
  if (!data.found || !data.globalPersonId) return { globalPersonId: null };
  return {
    globalPersonId: data.globalPersonId,
    masked: data.masked,
    fullName: data.fullName,
    firstName: data.firstName,
    middleName: data.middleName,
    lastName: data.lastName,
  };
}

function resolveBody(input: PersonIdentityInput) {
  const sex = normalizePersonSex(input.sex ?? input.gender);
  const birthDate = toBirthDateIso(input.birthDate);
  const composed =
    composePersonFullName(input.firstName, input.middleName, input.lastName) ||
    input.fullName?.trim() ||
    undefined;
  return {
    fin: input.fin,
    passport: input.passport,
    issuingCountry: input.issuingCountry,
    residencePermit: input.residencePermit,
    nationalId: input.nationalId,
    firstName: input.firstName?.trim() || undefined,
    middleName: input.middleName?.trim() || undefined,
    lastName: input.lastName?.trim() || undefined,
    fullName: composed,
    phone: input.phone,
    nationality: input.nationality,
    globalPersonId: input.globalPersonId?.trim() || undefined,
    ...(sex ? { sex } : {}),
    ...(birthDate ? { birthDate } : {}),
  };
}

/** Resolve or create person by FIN / passport / residence permit. Writes sex/DOB when provided. */
export async function resolvePersonIdentity(
  input: PersonIdentityInput,
  opts?: MdmClientOptions,
): Promise<{ globalPersonId: string | null }> {
  const token = serviceToken(opts);
  if (!token) return { globalPersonId: null };
  const res = await fetch(`${baseUrl(opts)}/internal/v1/mdm/persons/resolve`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(resolveBody(input)),
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

/** Canonical: resolve-or-create (and fill sex/DOB). Lookup FIN first only to surface masked flag. */
export async function linkPersonIdentity(
  input: PersonIdentityInput,
  opts?: MdmClientOptions & { requesterOrgId?: string; purpose?: string },
): Promise<{ globalPersonId: string | null; created?: boolean; masked?: boolean }> {
  if (!hasPersonNameInput(input) && !input.globalPersonId?.trim()) {
    return { globalPersonId: null };
  }
  let masked: boolean | undefined;
  if (input.fin?.trim() && !input.globalPersonId?.trim()) {
    const lookup = await lookupGlobalPersonByFin(input.fin.trim(), opts);
    if (lookup.globalPersonId) {
      masked = lookup.masked;
    }
  }
  const resolved = await resolvePersonIdentity(input, opts);
  return {
    globalPersonId: resolved.globalPersonId,
    created: Boolean(resolved.globalPersonId),
    masked,
  };
}

export type PersonIdentifierSummary = {
  id: string;
  type: string;
  issuingCountry: string | null;
  trust: string;
  isPrimary: boolean;
  createdAt: string;
};

/** List identifier types for a person (no decrypted values). */
export async function listPersonIdentifiers(
  globalPersonId: string,
  opts?: MdmClientOptions,
): Promise<{ globalPersonId: string | null; identifiers: PersonIdentifierSummary[] }> {
  const token = serviceToken(opts);
  if (!token || !globalPersonId.trim()) {
    return { globalPersonId: null, identifiers: [] };
  }
  const res = await fetch(
    `${baseUrl(opts)}/internal/v1/mdm/persons/${encodeURIComponent(globalPersonId.trim())}/identifiers`,
    {
      headers: authHeaders(token),
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!res.ok) return { globalPersonId: null, identifiers: [] };
  const data = (await res.json()) as {
    globalPersonId?: string;
    identifiers?: PersonIdentifierSummary[];
  };
  return {
    globalPersonId: data.globalPersonId ?? globalPersonId.trim(),
    identifiers: data.identifiers ?? [],
  };
}

export type PersonOpsProfile = {
  globalPersonId: string;
  fullName: string | null;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  phoneMasked: string | null;
  sex?: PersonSex | null;
  birthDate?: string | null;
  identifiers: Array<{
    type: string;
    maskedValue: string;
    issuingCountry?: string | null;
    isPrimary: boolean;
  }>;
  accessDenied?: boolean;
};

export type ComplianceIdentityResult = {
  globalPersonId: string;
  fin: string | null;
  passportNumber: string | null;
  issuingCountry: string | null;
  accessDenied: boolean;
};

function deploymentOrgId(): string | undefined {
  const { organizationId: id, source } = resolveSatelliteOrganizationId({
    allowFallback: true,
  });
  return source === "fallback" ? undefined : id;
}

export async function getPersonOpsProfile(
  globalPersonId: string,
  opts?: MdmClientOptions & { organizationId?: string },
): Promise<PersonOpsProfile | null> {
  const token = serviceToken(opts);
  if (!token || !globalPersonId.trim()) return null;
  const orgId = opts?.organizationId ?? deploymentOrgId();
  const q = orgId ? `?organizationId=${encodeURIComponent(orgId)}` : "";
  const res = await fetch(
    `${baseUrl(opts)}/internal/v1/mdm/persons/${encodeURIComponent(globalPersonId.trim())}/ops-profile${q}`,
    {
      headers: authHeaders(token),
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!res.ok) return null;
  return (await res.json()) as PersonOpsProfile;
}

/**
 * Batch ops-profile (max 100 ids). Returns sex / birthDate / name parts when granted.
 * Used by clinic patient-list fill for rows with demographic holes.
 */
export async function batchGetPersonOpsProfiles(
  personIds: string[],
  organizationId: string,
  opts?: MdmClientOptions,
): Promise<Record<string, PersonOpsProfile>> {
  const token = serviceToken(opts);
  const orgId = organizationId.trim();
  const unique = [...new Set(personIds.map((id) => id.trim()).filter(Boolean))];
  if (!token || !orgId || unique.length === 0) return {};

  const out: Record<string, PersonOpsProfile> = {};
  const CHUNK = 100;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK);
    const res = await fetch(`${baseUrl(opts)}/internal/v1/mdm/persons/ops-profile/batch`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ personIds: chunk, organizationId: orgId }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) continue;
    const data = (await res.json()) as Record<
      string,
      {
        globalPersonId?: string;
        displayName?: string | null;
        firstName?: string | null;
        middleName?: string | null;
        lastName?: string | null;
        sex?: string | null;
        birthDate?: string | null;
        accessDenied?: boolean;
        primaryIdentifierMasked?: string | null;
      }
    >;
    for (const [id, row] of Object.entries(data)) {
      const gpid = (row.globalPersonId ?? id).trim();
      out[gpid] = {
        globalPersonId: gpid,
        fullName: row.displayName ?? null,
        firstName: row.firstName ?? null,
        middleName: row.middleName ?? null,
        lastName: row.lastName ?? null,
        phoneMasked: null,
        sex: (row.sex as PersonOpsProfile["sex"]) ?? null,
        birthDate: row.birthDate ?? null,
        identifiers: [],
        accessDenied: Boolean(row.accessDenied),
      };
    }
  }
  return out;
}

export async function resolveIdentifierForCompliance(
  globalPersonId: string,
  opts?: MdmClientOptions & { organizationId?: string },
): Promise<ComplianceIdentityResult | null> {
  const token = serviceToken(opts);
  const orgId = opts?.organizationId ?? deploymentOrgId();
  if (!token || !globalPersonId.trim() || !orgId) return null;
  const q = `?organizationId=${encodeURIComponent(orgId)}`;
  const res = await fetch(
    `${baseUrl(opts)}/internal/v1/mdm/persons/${encodeURIComponent(globalPersonId.trim())}/compliance-identity${q}`,
    {
      headers: authHeaders(token),
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!res.ok) return null;
  return (await res.json()) as ComplianceIdentityResult;
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
