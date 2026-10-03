import { hasActiveModule, satelliteOrganizationId } from "@era/satellite-kit";
import { loadBankSubscriptionSnapshot } from "@/lib/engine-client";

export const BANKING_MODULES = [
  "industry_banking",
  "banking_core",
  "banking_payments",
  "banking_deposits",
  "banking_loans",
  "banking_aml",
  "banking_cards",
  "banking_treasury",
  "banking_regreporting",
  "banking_risk",
] as const;

/** Banking modules the ops nav may show for this org. Gate-only or empty snapshot exposes all L2 modules. */
export async function bankActiveModules(): Promise<string[]> {
  let bankOrgId = "";
  try {
    const id = satelliteOrganizationId();
    bankOrgId = id === "demo-org" ? "" : id;
  } catch {
    bankOrgId = "";
  }

  if (!bankOrgId || process.env.NODE_ENV !== "production") {
    return [...BANKING_MODULES];
  }

  const snapshot = await loadBankSubscriptionSnapshot();
  if (!snapshot) return [...BANKING_MODULES];

  const modules = BANKING_MODULES.filter((m) => hasActiveModule(snapshot, m));
  // Empty / gate-only: expose L2 banking modules for ops nav (matches assertBankingEntitlement).
  if (
    modules.length === 0 ||
    (hasActiveModule(snapshot, "industry_banking") &&
      !modules.some((m) => m.startsWith("banking_")))
  ) {
    return [...BANKING_MODULES];
  }
  return modules;
}
