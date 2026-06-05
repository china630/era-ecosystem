export type ClinicCapacitySummary = {
  bookingAllowed: boolean;
  riskLevel: string;
  guestEquivalent: number;
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
    return (await res.json()) as ClinicCapacitySummary;
  } catch {
    return null;
  }
}

export async function assertSanatoriumBookingAllowed(refDate = new Date()): Promise<void> {
  const cap = await fetchClinicCapacitySummary(refDate);
  if (cap && !cap.bookingAllowed) {
    throw new Error(
      `Clinic capacity critical (~${cap.guestEquivalent} guest-equiv/week); sanatorium booking blocked`,
    );
  }
}
