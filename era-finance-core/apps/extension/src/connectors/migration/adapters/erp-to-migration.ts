import type { MigrationPrefillPayload } from "../index";

/** Maps ERP/PMS prefill JSON to portal field ids (skeleton — no DOM write). */
export function mapErpToMigrationFields(
  payload: MigrationPrefillPayload,
): Record<string, string> {
  const p = payload.person ?? {};
  return {
    fullName: String(p.fullName ?? ""),
    passportNumber: String(p.passportNumber ?? ""),
    nationality: String(p.nationality ?? ""),
    visaExpiry: String(p.visaExpiry ?? ""),
  };
}
