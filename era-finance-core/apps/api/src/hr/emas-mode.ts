/** Org.settings.hr.emasMode — Evrostar wave 7 / PRD §13.2 */
export type EmasMode = "OFF" | "SELECTIVE" | "FULL";

export const EMAS_MODES: readonly EmasMode[] = ["OFF", "SELECTIVE", "FULL"] as const;

export function parseEmasMode(settings: unknown): EmasMode {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return "OFF";
  }
  const hr = (settings as Record<string, unknown>).hr;
  if (!hr || typeof hr !== "object" || Array.isArray(hr)) return "OFF";
  const mode = (hr as Record<string, unknown>).emasMode;
  if (mode === "OFF" || mode === "SELECTIVE" || mode === "FULL") return mode;
  return "OFF";
}

/**
 * Whether a hire/terminate should create a PENDING_MANUAL queue row.
 * OFF → never. SELECTIVE → only emasEligible. FULL → always (FIN may still be pending).
 */
export function shouldEnqueueEmasManual(opts: {
  mode: EmasMode;
  emasEligible: boolean;
}): boolean {
  if (opts.mode === "OFF") return false;
  if (opts.mode === "SELECTIVE") return opts.emasEligible === true;
  return true;
}
