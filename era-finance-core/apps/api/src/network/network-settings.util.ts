import type { PostingRole } from "@erafinance/database";

export type NetworkDocumentsSettings = {
  acceptInbound?: boolean;
  autoPostSafeRoles?: string[];
};

export function parseNetworkDocumentsSettings(
  settings: unknown,
): NetworkDocumentsSettings {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return {};
  }
  const root = settings as Record<string, unknown>;
  const nd = root.networkDocuments;
  if (!nd || typeof nd !== "object" || Array.isArray(nd)) {
    return {};
  }
  const o = nd as Record<string, unknown>;
  const auto = o.autoPostSafeRoles;
  return {
    acceptInbound: o.acceptInbound === true,
    autoPostSafeRoles: Array.isArray(auto)
      ? auto.filter((x): x is string => typeof x === "string")
      : undefined,
  };
}

export function mergeNetworkDocumentsSettings(
  settings: unknown,
  patch: NetworkDocumentsSettings,
): Record<string, unknown> {
  const base =
    settings && typeof settings === "object" && !Array.isArray(settings)
      ? { ...(settings as Record<string, unknown>) }
      : {};
  const prev = parseNetworkDocumentsSettings(base);
  const next: NetworkDocumentsSettings = {
    acceptInbound: patch.acceptInbound ?? prev.acceptInbound,
    autoPostSafeRoles: patch.autoPostSafeRoles ?? prev.autoPostSafeRoles,
  };
  return {
    ...base,
    networkDocuments: {
      ...prev,
      ...next,
    },
  };
}

export const NETWORK_INBOUND_DEBIT_ROLES = [
  "INVENTORY_GOODS",
  "MISC_OPERATING_EXPENSE",
  "PREPAID_ASSET",
] as const satisfies readonly PostingRole[];

export type NetworkInboundDebitRole = (typeof NETWORK_INBOUND_DEBIT_ROLES)[number];

export function assertNetworkDebitRole(role: string): NetworkInboundDebitRole {
  if (!(NETWORK_INBOUND_DEBIT_ROLES as readonly string[]).includes(role)) {
    throw new Error(`Invalid network debit role: ${role}`);
  }
  return role as NetworkInboundDebitRole;
}
