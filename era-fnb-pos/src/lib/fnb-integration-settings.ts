import { prisma } from "@/lib/prisma";
import { getFnbOrgProfile } from "@/lib/fnb-org-profile";
import { requestOrganizationId } from "@/lib/request-organization";

export type FnbIntegrationSettings = {
  /** Public Finance web origin for Open Finance deep-link (e.g. https://finance-core.era-365.online). */
  financeWebUrl: string;
  /**
   * Legacy last-resort Hotel PMS base when peer resolve fails (local only).
   * S2S SoR = SatelliteEndpoint peer — not this field. UI no longer edits it.
   */
  hotelPmsUrl: string;
  /**
   * Legacy orch API override. Runtime uses resolveOrchestratorBaseUrl (+ hairpin).
   * UI no longer edits it.
   */
  orchestratorBaseUrl: string;
};

const EMPTY: FnbIntegrationSettings = {
  financeWebUrl: "",
  hotelPmsUrl: "",
  orchestratorBaseUrl: "",
};

function parseJson(raw: unknown): FnbIntegrationSettings {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...EMPTY };
  const o = raw as Record<string, unknown>;
  return {
    financeWebUrl: typeof o.financeWebUrl === "string" ? o.financeWebUrl.trim() : "",
    hotelPmsUrl: typeof o.hotelPmsUrl === "string" ? o.hotelPmsUrl.trim() : "",
    orchestratorBaseUrl:
      typeof o.orchestratorBaseUrl === "string" ? o.orchestratorBaseUrl.trim() : "",
  };
}

export async function getFnbIntegrationSettings(
  organizationId?: string,
): Promise<FnbIntegrationSettings> {
  const orgId = organizationId?.trim() || requestOrganizationId();
  await getFnbOrgProfile(orgId);
  const row = await prisma.fnbOrgProfile.findUnique({
    where: { organizationId: orgId },
    select: { integrationSettingsJson: true },
  });
  return parseJson(row?.integrationSettingsJson);
}

export async function upsertFnbIntegrationSettings(
  patch: Partial<FnbIntegrationSettings>,
  organizationId?: string,
): Promise<FnbIntegrationSettings> {
  const orgId = organizationId?.trim() || requestOrganizationId();
  await getFnbOrgProfile(orgId);
  const current = await getFnbIntegrationSettings(orgId);
  const next: FnbIntegrationSettings = {
    financeWebUrl:
      patch.financeWebUrl !== undefined
        ? String(patch.financeWebUrl).trim()
        : current.financeWebUrl,
    hotelPmsUrl:
      patch.hotelPmsUrl !== undefined
        ? String(patch.hotelPmsUrl).trim()
        : current.hotelPmsUrl,
    orchestratorBaseUrl:
      patch.orchestratorBaseUrl !== undefined
        ? String(patch.orchestratorBaseUrl).trim()
        : current.orchestratorBaseUrl,
  };
  await prisma.fnbOrgProfile.update({
    where: { organizationId: orgId },
    data: { integrationSettingsJson: next },
  });
  return next;
}

/** Normalize origin: trim trailing slash. Empty → null. */
export function normalizePublicOrigin(url: string | null | undefined): string | null {
  const t = url?.trim() ?? "";
  if (!t) return null;
  return t.replace(/\/$/, "");
}
