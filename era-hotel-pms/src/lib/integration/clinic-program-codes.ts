import { requestOrganizationId } from "@/lib/request-organization";
import { resolveClinicProgramCode } from "@/lib/services/medical-package-resolve.service";

const TTL_MS = 60_000;
let cache: { at: number; codes: Set<string> } | null = null;

/** Current clinic template codes. Null when the clinic did not answer. */
export async function loadClinicProgramCodes(): Promise<Set<string> | null> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.codes;
  const base = (process.env.CLINIC_INTERNAL_URL ?? process.env.CLINIC_URL ?? process.env.ERA_CLINIC_URL ?? "")
    .replace(/\/$/, "");
  const token = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim() ?? "";
  if (!base || !token) return cache?.codes ?? null;
  const org = requestOrganizationId();
  const res = await fetch(
    `${base}/api/internal/v1/program-template-codes?organizationId=${encodeURIComponent(org)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    },
  ).catch(() => null);
  if (!res?.ok) return cache?.codes ?? null;
  const body = (await res.json().catch(() => null)) as { codes?: unknown } | null;
  const codes = new Set(
    (Array.isArray(body?.codes) ? body.codes : [])
      .map((code) => String(code).trim().toUpperCase())
      .filter(Boolean),
  );
  cache = { at: Date.now(), codes };
  return codes;
}

export async function clinicProgramCodeForEvent(
  plan: { code?: string | null } | null | undefined,
): Promise<string | undefined> {
  const codes = await loadClinicProgramCodes();
  return resolveClinicProgramCode(plan?.code, codes) ?? undefined;
}

export async function acceptGuestPackageCode(
  raw: string | null | undefined,
): Promise<string | null> {
  const codes = await loadClinicProgramCodes();
  return resolveClinicProgramCode(raw, codes);
}
