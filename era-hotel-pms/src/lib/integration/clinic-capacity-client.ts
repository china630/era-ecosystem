export type ClinicCapacitySummary = {
  bookingAllowed: boolean;
  riskLevel: 'ok' | 'warning' | 'critical' | string;
  guestEquivalent: number;
  remainingPct?: number;
  remainingSlots?: number;
  totalSlots?: number;
  occupiedSlots?: number;
  warnPct?: number;
  criticalPct?: number;
  from?: string;
  to?: string;
  message?: string;
};

export async function fetchClinicCapacitySummary(
  refDate = new Date(),
): Promise<ClinicCapacitySummary | null> {
  const base = (process.env.CLINIC_URL ?? process.env.ERA_CLINIC_URL ?? '').replace(
    /\/$/,
    '',
  );
  const secret = process.env.CLINIC_BRIDGE_SECRET;
  if (!base || !secret) return null;
  try {
    const qs = `date=${encodeURIComponent(refDate.toISOString().slice(0, 10))}`;
    const res = await fetch(`${base}/api/capacity/summary?${qs}`, {
      headers: { 'x-clinic-bridge-secret': secret },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const raw = (await res.json()) as ClinicCapacitySummary;
    return raw;
  } catch {
    return null;
  }
}

export async function assertSanatoriumBookingAllowed(refDate = new Date()): Promise<void> {
  const cap = await fetchClinicCapacitySummary(refDate);
  if (cap && !cap.bookingAllowed) {
    const detail =
      cap.message ??
      `Clinic capacity critical (~${cap.guestEquivalent} guest-equiv/week; ${cap.remainingPct ?? '?'}% slots left)`;
    throw new Error(detail);
  }
}
