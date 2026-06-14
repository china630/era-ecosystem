import type { ScheduledProcedure } from '@/lib/clinic-procedure-validate';

const CLINIC_URL = process.env.CLINIC_BRIDGE_URL?.replace(/\/$/, '');
const TOKEN =
  process.env.CLINIC_INTERNAL_SERVICE_TOKEN?.trim() ||
  process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();

export async function validateProcedureWithClinic(input: {
  procedureCode: string;
  startAt: Date;
  endAt: Date;
  existing: ScheduledProcedure[];
}): Promise<{ ok: boolean; violations: Array<{ message: string }> }> {
  if (!CLINIC_URL || !TOKEN) {
    return { ok: true, violations: [] };
  }
  try {
    const res = await fetch(`${CLINIC_URL}/api/internal/v1/procedure-validate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      return { ok: true, violations: [] };
    }
    return res.json() as Promise<{ ok: boolean; violations: Array<{ message: string }> }>;
  } catch {
    return { ok: true, violations: [] };
  }
}
