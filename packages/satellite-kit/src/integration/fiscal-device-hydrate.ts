import {
  getDeviceDirectory,
  type FiscalDeviceRef,
} from "@era/fiscal";

export type FiscalDeviceSyncRow = {
  id: string;
  organizationId: string;
  kind: "FISCAL_KKM" | "BANK_POS";
  providerId: string;
  label: string;
  outletCode?: string | null;
  registerCode?: string | null;
  serial?: string | null;
  externalIds?: Record<string, string> | null;
  endpoint?: string | null;
  secretsCipher?: string | null;
  /** Plain secrets from orch Sync (internal token). Prefer over cipher. */
  secrets?: Record<string, string> | null;
  status: "active" | "retired";
  isOrgDefault?: boolean;
  isOutletDefault?: boolean;
  isRegisterDefault?: boolean;
};

/**
 * Replace in-memory directory rows for one org from Sync payload.
 * Secrets stay in-memory on the device row after orch decrypts at Sync.
 */
export function hydrateFiscalDevicesFromSync(
  organizationId: string,
  rows: FiscalDeviceSyncRow[],
): void {
  const dir = getDeviceDirectory();
  for (const existing of dir.list(organizationId)) {
    dir.remove(organizationId, existing.id);
  }
  for (const r of rows) {
    if (r.organizationId !== organizationId) continue;
    const ref: FiscalDeviceRef = {
      id: r.id,
      organizationId: r.organizationId,
      kind: r.kind,
      providerId: r.providerId,
      label: r.label,
      outletCode: r.outletCode ?? null,
      registerCode: r.registerCode ?? null,
      serial: r.serial ?? null,
      externalIds: r.externalIds ?? undefined,
      endpoint: r.endpoint ?? null,
      secrets: r.secrets ?? undefined,
      status: r.status,
      isOrgDefault: r.isOrgDefault,
      isOutletDefault: r.isOutletDefault,
      isRegisterDefault: r.isRegisterDefault,
    };
    dir.upsert(ref);
  }
}
