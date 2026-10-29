/**
 * CP-ORG-PROFILE-01 Track A — publish Finance primary bank summary to orch profile.bankLine.
 * Best-effort: never fail the local bank CRUD if Sync/orch is down.
 */
import {
  resolveControlPlaneServiceToken,
  resolveOrchestratorInternalUrl,
} from "./control-plane-credentials";

export function formatOrgBankLine(account: {
  bankName: string | null;
  accountNumber?: string | null;
  currency: string | null;
  iban: string | null;
  swift: string | null;
} | null): string | null {
  if (!account) return null;
  const parts = [
    account.bankName,
    account.accountNumber,
    account.currency,
    account.iban ? `IBAN ${account.iban}` : null,
    account.swift ? `SWIFT ${account.swift}` : null,
  ].filter(Boolean);
  const line = parts.join(" · ").trim();
  return line || null;
}

export async function publishOrgProfileBankLine(
  organizationId: string,
  bankLine: string | null,
): Promise<{ ok: boolean; skipped?: string }> {
  const base = resolveOrchestratorInternalUrl();
  const token = resolveControlPlaneServiceToken();
  if (!base || !token) {
    return { ok: false, skipped: "orch_credentials_missing" };
  }
  try {
    const res = await fetch(
      `${base}/internal/v1/organizations/${organizationId}/profile-bank-line`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-service-token": token,
        },
        body: JSON.stringify({ bankLine }),
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!res.ok) {
      return { ok: false, skipped: `http_${res.status}` };
    }
    return { ok: true };
  } catch {
    return { ok: false, skipped: "network" };
  }
}
