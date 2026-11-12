/**
 * Host disk precheck before compose apply / import.
 * Agent reports free bytes; orch fails closed when below minimum.
 */

export const DEFAULT_PLACEMENT_MIN_FREE_BYTES = 2 * 1024 * 1024 * 1024; // 2 GiB

export function parsePlacementMinFreeBytes(
  envValue?: string | null,
): number {
  const raw = envValue?.trim();
  if (!raw) return DEFAULT_PLACEMENT_MIN_FREE_BYTES;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_PLACEMENT_MIN_FREE_BYTES;
  return Math.floor(n);
}

export function diskPrecheckOk(input: {
  freeBytes: number | null | undefined;
  minFreeBytes?: number;
}): { ok: boolean; reason?: string } {
  const min = input.minFreeBytes ?? DEFAULT_PLACEMENT_MIN_FREE_BYTES;
  const free = input.freeBytes;
  if (free == null || !Number.isFinite(free)) {
    return { ok: false, reason: "disk free bytes unknown" };
  }
  if (free < min) {
    return {
      ok: false,
      reason: `disk free ${free} < min ${min}`,
    };
  }
  return { ok: true };
}
