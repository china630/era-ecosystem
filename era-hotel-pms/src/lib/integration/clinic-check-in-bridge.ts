type ClinicCheckInInput = {
  reservationId: string;
  guestName: string;
  passportNumber?: string;
  phone?: string;
  globalPersonId?: string | null;
  organizationId?: string;
};

function clinicBaseUrl(): string | null {
  const base = (
    process.env.CLINIC_URL ??
    process.env.ERA_CLINIC_URL ??
    process.env.CLINIC_API_URL ??
    ''
  ).replace(/\/$/, '');
  return base || null;
}

/** Direct HTTP fallback for hotel → clinic check-in (disabled by default). */
export async function notifyClinicCheckIn(input: ClinicCheckInInput): Promise<void> {
  const base = clinicBaseUrl();
  const secret = process.env.CLINIC_BRIDGE_SECRET?.trim();
  if (!base || !secret) {
    console.warn('notifyClinicCheckIn skipped: CLINIC_URL or CLINIC_BRIDGE_SECRET not set');
    return;
  }

  const organizationId =
    input.organizationId ??
    process.env.ERA_SATELLITE_ORGANIZATION_ID ??
    process.env.ORGANIZATION_ID;
  if (!organizationId) {
    console.warn('notifyClinicCheckIn skipped: organizationId missing');
    return;
  }

  const res = await fetch(`${base}/api/sanatorium/episodes/from-stay`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-clinic-bridge-secret': secret,
    },
    body: JSON.stringify({
      reservationId: input.reservationId,
      guestName: input.guestName,
      passportNumber: input.passportNumber ?? 'N/A',
      phone: input.phone,
      globalPersonId: input.globalPersonId ?? null,
      organizationId,
    }),
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Clinic check-in bridge failed (${res.status}): ${text}`);
  }
}

export function isClinicHttpBridgeEnabled(): boolean {
  return process.env.ERA_HOTEL_CLINIC_HTTP_BRIDGE === 'true';
}
