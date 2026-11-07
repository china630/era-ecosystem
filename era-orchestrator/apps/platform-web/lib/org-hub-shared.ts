/** Shared types/helpers for SuperAdmin org hub tabs (platform-web). */

export type OperatingMode = {
  organizationId: string;
  name: string;
  publicOrgNumber: number;
  mode: "STANDALONE" | "DEPARTMENT";
  parentOrgId: string | null;
  fiscalRouting: "OWN" | "PARENT";
  revenueRouting: "OWN" | "PARENT";
};

export type SatelliteEndpoint = {
  satelliteKey: string;
  baseUrl: string;
  enabled: boolean;
};

export type DepartmentRow = {
  id: string;
  name: string;
  operatingMode: string;
  parentOrgId: string | null;
  publicOrgNumber: number;
  createdAt: string;
};

export type VendorBridgeBundle = {
  organizationId: string;
  industries: string[];
  elektrawebBridge: {
    inboundEnabled: boolean;
    writeEnabled: boolean;
    elektrawebHotelId: number | null;
    spaDepId: number | null;
    spaCurrencyId: number | null;
    walkinResId: string | null;
    walkinResNameId: string | null;
  } | null;
  clinicCutover: {
    elektrawebDualRun: boolean;
    hotelOrganizationId: string | null;
  } | null;
};

export type BridgeDraft = {
  inboundEnabled: boolean;
  writeEnabled: boolean;
  elektrawebHotelId: string;
  spaDepId: string;
  spaCurrencyId: string;
  walkinResId: string;
  walkinResNameId: string;
};

export type CutoverDraft = {
  elektrawebDualRun: boolean;
  hotelOrganizationId: string;
};

export type FiscalDeviceRow = {
  id: string;
  kind: string;
  providerId: string;
  label: string;
  outletCode: string | null;
  registerCode: string | null;
  endpoint: string | null;
  status: string;
  isOrgDefault: boolean;
  hasSecrets: boolean;
};

export type ChannelRow = {
  id: string;
  fromOrgId: string;
  fromSatelliteKey: string;
  toOrgId: string;
  toSatelliteKey: string;
  kind: string;
  enabled: boolean;
  managedBy: string;
  fromOrgName?: string | null;
  toOrgName?: string | null;
};

export type PaymentMethodRow = {
  id: string;
  code: string;
  nameAz: string;
  nameRu: string;
  nameEn: string;
  active: boolean;
  satellites: string[];
  fiscalHint: string;
  sortOrder?: number;
  fiscalDeviceId?: string | null;
};

export type OrgHeaderMeta = {
  name: string;
  publicOrgNumber: number | null;
  mode: string | null;
  topology: string | null;
  tier: string | null;
  billingStatus: string | null;
  industries: string[];
};

export const ENDPOINT_PRESETS = [
  "industry_hotel_pms",
  "industry_fnb_pos",
  "industry_clinic",
  "industry_retail",
  "industry_logistics",
  "industry_construction",
  "industry_crm",
  "industry_auto_service",
  "industry_wholesale",
  "finance_core",
] as const;

export const EMPTY_BRIDGE: BridgeDraft = {
  inboundEnabled: false,
  writeEnabled: false,
  elektrawebHotelId: "",
  spaDepId: "",
  spaCurrencyId: "",
  walkinResId: "",
  walkinResNameId: "",
};

export const EMPTY_CUTOVER: CutoverDraft = {
  elektrawebDualRun: false,
  hotelOrganizationId: "",
};

export type FieldNotice = { kind: "ok" | "err"; text: string };

export function parseOptionalInt(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function noticeFromFailedResponse(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (typeof body.message === "string" && body.message.trim()) return body.message.trim();
    if (Array.isArray(body.message) && body.message[0]) return String(body.message[0]);
  } catch {
    /* ignore non-JSON */
  }
  return "";
}

/** Comma list of satellites that did not accept the pushed policy; empty when all did. */
export async function undeliveredSatellites(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as {
      delivery?: Array<{ satelliteKey: string; ok: boolean }>;
    };
    return (body.delivery ?? [])
      .filter((d) => !d.ok)
      .map((d) => d.satelliteKey)
      .join(", ");
  } catch {
    return "";
  }
}

export function groupChannelsByPeer(
  rows: ChannelRow[],
  direction: "outbound" | "inbound",
): Array<{ peerKey: string; channels: ChannelRow[] }> {
  const order: string[] = [];
  const map = new Map<string, ChannelRow[]>();
  for (const row of rows) {
    const key = direction === "outbound" ? row.toSatelliteKey : row.fromSatelliteKey;
    if (!map.has(key)) {
      order.push(key);
      map.set(key, []);
    }
    map.get(key)!.push(row);
  }
  return order.map((peerKey) => ({ peerKey, channels: map.get(peerKey)! }));
}

export function showCutoverTab(industries: string[]): boolean {
  return industries.includes("hotel") || industries.includes("clinic");
}

/** Same rules as org shell: bridge industries + enabled endpoints + DEPARTMENT → clinic. */
export function resolveCutoverIndustries(input: {
  bridgeIndustries?: string[] | null;
  endpoints?: Array<{ satelliteKey: string; enabled: boolean }> | null;
  operatingMode?: string | null;
}): string[] {
  const industries = [...(input.bridgeIndustries ?? [])];
  for (const e of input.endpoints ?? []) {
    if (
      e.enabled &&
      e.satelliteKey === "industry_hotel_pms" &&
      !industries.includes("hotel")
    ) {
      industries.push("hotel");
    }
    if (
      e.enabled &&
      e.satelliteKey === "industry_clinic" &&
      !industries.includes("clinic")
    ) {
      industries.push("clinic");
    }
  }
  if (input.operatingMode === "DEPARTMENT" && !industries.includes("clinic")) {
    industries.push("clinic");
  }
  return industries;
}
