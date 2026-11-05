/**
 * In-memory org payment method catalog from orchestrator Sync.
 * Empty catalog → desks keep their baked-in fallback until the first Sync.
 */

export type PaymentMethodSyncRow = {
  id: string;
  organizationId: string;
  code: string;
  nameAz: string;
  nameRu: string;
  nameEn: string;
  sortOrder: number;
  active: boolean;
  systemKey?: string | null;
  fiscalHint: "CASH" | "CARD" | "NONE" | string;
  fiscalDeviceId?: string | null;
  satellites: string[];
  secrets?: Record<string, string> | null;
};

export type OrgPaymentMethodDesk = {
  code: string;
  nameAz: string;
  nameRu: string;
  nameEn: string;
  sortOrder: number;
  fiscalHint: string;
  fiscalDeviceId: string | null;
};

type OrgCatalog = {
  synced: boolean;
  catalogOrgId: string;
  fiscalRouting: string;
  parentOrgId: string | null;
  methods: PaymentMethodSyncRow[];
};

const byOrg = new Map<string, OrgCatalog>();

export function hydratePaymentMethodsFromSync(
  organizationId: string,
  rows: PaymentMethodSyncRow[],
  meta?: {
    catalogOrgId?: string;
    fiscalRouting?: string;
    parentOrgId?: string | null;
  },
): void {
  byOrg.set(organizationId, {
    synced: true,
    catalogOrgId: meta?.catalogOrgId ?? organizationId,
    fiscalRouting: meta?.fiscalRouting ?? "OWN",
    parentOrgId: meta?.parentOrgId ?? null,
    methods: rows.filter((r) => r.active),
  });
}

export function paymentMethodsSynced(organizationId: string): boolean {
  return byOrg.get(organizationId)?.synced === true;
}

export function listPaymentMethodsForSatellite(input: {
  organizationId: string;
  satelliteKey: "hotel" | "clinic" | "fnb" | "retail" | string;
}): OrgPaymentMethodDesk[] {
  const cat = byOrg.get(input.organizationId);
  if (!cat?.synced) return [];
  const key = input.satelliteKey.trim().toLowerCase();
  return cat.methods
    .filter((row) => row.satellites.map((s) => s.toLowerCase()).includes(key))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code))
    .map((row) => ({
      code: row.code,
      nameAz: row.nameAz,
      nameRu: row.nameRu,
      nameEn: row.nameEn,
      sortOrder: row.sortOrder,
      fiscalHint: row.fiscalHint,
      fiscalDeviceId: row.fiscalDeviceId ?? null,
    }));
}

export function paymentMethodRouting(organizationId: string): {
  catalogOrgId: string;
  fiscalRouting: string;
  parentOrgId: string | null;
} | null {
  const cat = byOrg.get(organizationId);
  if (!cat?.synced) return null;
  return {
    catalogOrgId: cat.catalogOrgId,
    fiscalRouting: cat.fiscalRouting,
    parentOrgId: cat.parentOrgId,
  };
}

/** Test / process reset. */
export function clearPaymentMethodCatalog(): void {
  byOrg.clear();
}
