export type SettlementHubMode = "HOTEL_FRONT_CASH" | "SATELLITE_OWN";
export type PendingSettlementNaPolicy = "BLOCK" | "WARN";

export type SettlementPolicySnapshot = {
  settlementHub: SettlementHubMode;
  pendingSettlementNaPolicy: PendingSettlementNaPolicy;
  hubOrganizationId: string | null;
  deferWalkInToHub: boolean;
};

export type OrgSettlementInput = {
  id: string;
  operatingMode: string;
  parentOrgId: string | null;
  fiscalRouting: string;
  settings: unknown;
};

function parseSettingsJson(settings: unknown): Record<string, unknown> {
  if (settings && typeof settings === "object" && !Array.isArray(settings)) {
    return settings as Record<string, unknown>;
  }
  return {};
}

function asSettlementHub(v: unknown): SettlementHubMode | null {
  if (v === "HOTEL_FRONT_CASH" || v === "SATELLITE_OWN") return v;
  return null;
}

function asNaPolicy(v: unknown): PendingSettlementNaPolicy {
  return v === "WARN" ? "WARN" : "BLOCK";
}

/** Build settlement hub policy for subscription snapshot. */
export function buildSettlementPolicy(
  org: OrgSettlementInput,
  options?: {
    parentOrg?: OrgSettlementInput | null;
    departmentChildCount?: number;
  },
): SettlementPolicySnapshot {
  const settings = parseSettingsJson(org.settings);
  const parentSettings = options?.parentOrg
    ? parseSettingsJson(options.parentOrg.settings)
    : {};

  const naPolicy = asNaPolicy(
    settings.pendingSettlementNaPolicy ?? parentSettings.pendingSettlementNaPolicy,
  );

  if (
    org.operatingMode === "DEPARTMENT" &&
    org.fiscalRouting === "PARENT" &&
    org.parentOrgId
  ) {
    const explicit =
      asSettlementHub(settings.settlementHub) ??
      asSettlementHub(parentSettings.settlementHub);
    const hub: SettlementHubMode = explicit ?? "HOTEL_FRONT_CASH";

    return {
      settlementHub: hub,
      pendingSettlementNaPolicy: asNaPolicy(
        parentSettings.pendingSettlementNaPolicy ??
          settings.pendingSettlementNaPolicy,
      ),
      hubOrganizationId: org.parentOrgId,
      deferWalkInToHub: hub === "HOTEL_FRONT_CASH",
    };
  }

  const explicit = asSettlementHub(settings.settlementHub);
  const hasDeptChildren = (options?.departmentChildCount ?? 0) > 0;
  const hub: SettlementHubMode =
    explicit ??
    (hasDeptChildren ? "HOTEL_FRONT_CASH" : "SATELLITE_OWN");

  return {
    settlementHub: hub,
    pendingSettlementNaPolicy: naPolicy,
    hubOrganizationId: hub === "HOTEL_FRONT_CASH" ? org.id : null,
    deferWalkInToHub: false,
  };
}
