/** English short labels for channel UI (apps may override via i18n). */

const SATELLITE_KEY_LABELS: Record<string, string> = {
  industry_hotel_pms: "Hotel",
  industry_clinic: "Clinic",
  industry_fnb_pos: "F&B",
  industry_retail: "Retail",
  industry_auto_service: "Auto",
  industry_auto: "Auto",
  industry_crm: "CRM",
  industry_wholesale: "Wholesale",
  industry_logistics: "Logistics",
  industry_construction: "Construction",
  finance_core: "Finance",
  industry_banking: "Bank",
  industry_bank_dbo: "Bank DBO",
  data_hub: "Data Hub",
};

const CHANNEL_KIND_LABELS: Record<string, string> = {
  FOLIO_POST: "Folio post",
  SETTLEMENT: "Settlement",
  REVENUE_EVENT: "Revenue event",
  READ_STATUS: "Read status",
  OPS_HANDOFF: "Ops handoff",
};

const MANAGED_BY_LABELS: Record<string, string> = {
  PLATFORM: "Platform",
  ACCEPTOR: "Acceptor",
};

export function labelSatelliteKey(key: string): string {
  const k = key.trim();
  return SATELLITE_KEY_LABELS[k] ?? k.replace(/^industry_/, "").replace(/_/g, " ");
}

export function labelChannelKind(kind: string): string {
  const k = kind.trim();
  return CHANNEL_KIND_LABELS[k] ?? k;
}

export function labelChannelManagedBy(managedBy: string): string {
  const k = managedBy.trim();
  return MANAGED_BY_LABELS[k] ?? k;
}

export function channelEdgeTitle(input: {
  fromKey: string;
  toKey: string;
  fromOrgName?: string | null;
  toOrgName?: string | null;
  direction: "outbound" | "inbound";
  /** Override satellite short labels (i18n). */
  labelSat?: (key: string) => string;
}): string {
  const label = input.labelSat ?? labelSatelliteKey;
  const fromSat = label(input.fromKey);
  const toSat = label(input.toKey);
  if (input.direction === "outbound") {
    const dest = input.toOrgName?.trim() || toSat;
    return `${fromSat} → ${dest} / ${toSat}`;
  }
  const src = input.fromOrgName?.trim() || fromSat;
  return `${src} / ${fromSat} → ${toSat}`;
}
