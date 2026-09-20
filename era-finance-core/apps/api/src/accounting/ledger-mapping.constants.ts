/** P0 Multi-GAAP integrity constants. */
export const LEDGER_MAPPING_CODE_NAS_TO_IFRS = "NAS_TO_IFRS";

export type LedgerMirrorMode = "soft" | "strict";

export const MIRROR_ERROR = {
  MISSING_IFRS_MAPPING: "MISSING_IFRS_MAPPING",
  IFRS_UNBALANCED: "IFRS_UNBALANCED",
  SEMANTIC_TYPE_MISMATCH: "SEMANTIC_TYPE_MISMATCH",
  NO_PUBLISHED_SET: "NO_PUBLISHED_SET",
  TARGET_ACCOUNT_MISSING: "TARGET_ACCOUNT_MISSING",
} as const;

export type MirrorErrorCode =
  (typeof MIRROR_ERROR)[keyof typeof MIRROR_ERROR];

export function parseLedgerMirrorMode(settings: unknown): LedgerMirrorMode {
  if (settings == null || typeof settings !== "object") return "soft";
  const lm = (settings as { ledgerMirror?: { mode?: unknown } }).ledgerMirror;
  return lm?.mode === "strict" ? "strict" : "soft";
}

export function mergeLedgerMirrorSettings(
  settings: unknown,
  patch: { mode?: LedgerMirrorMode },
): Record<string, unknown> {
  const base =
    settings != null && typeof settings === "object"
      ? { ...(settings as Record<string, unknown>) }
      : {};
  const prev =
    base.ledgerMirror != null && typeof base.ledgerMirror === "object"
      ? { ...(base.ledgerMirror as Record<string, unknown>) }
      : {};
  if (patch.mode != null) prev.mode = patch.mode;
  if (prev.mappingSetCode == null) {
    prev.mappingSetCode = LEDGER_MAPPING_CODE_NAS_TO_IFRS;
  }
  base.ledgerMirror = prev;
  return base;
}
