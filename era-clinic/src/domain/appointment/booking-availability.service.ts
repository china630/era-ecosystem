import { addBakuDays, bakuDayBounds } from "@/lib/baku-day";
import { resolveAppointmentDurationMinutes } from "@/lib/scheduling.service";
import { electiveDayDenied } from "@/domain/appointment/elective-day";
import {
  findPractitionerByCode,
  getPractitionerDayMatrix,
} from "@/domain/appointment/appointment-calendar.service";

export type BookingAvailabilitySlot = {
  scheduledAt: string;
  practitionerCode: string;
  practitionerName: string;
  durationMinutes: number;
};

export async function listBookingAvailability(input: {
  practitionerCode: string;
  serviceCode?: string;
  fromYmd: string;
  toYmd: string;
}): Promise<{
  from: string;
  to: string;
  durationMinutes: number;
  closedDays: string[];
  slots: BookingAvailabilitySlot[];
}> {
  const practitioner = await findPractitionerByCode(input.practitionerCode);
  if (!practitioner) {
    return {
      from: input.fromYmd,
      to: input.toYmd,
      durationMinutes: 0,
      closedDays: [],
      slots: [],
    };
  }

  const durationMinutes = await resolveAppointmentDurationMinutes({
    serviceCode: input.serviceCode,
  });

  const slots: BookingAvailabilitySlot[] = [];
  const closedDays: string[] = [];

  let cursor = input.fromYmd;
  const last = input.toYmd;
  let guard = 0;
  while (cursor <= last && guard < 62) {
    guard += 1;
    const dayStart = bakuDayBounds(cursor).start;
    if (await electiveDayDenied(dayStart)) {
      closedDays.push(cursor);
      cursor = addBakuDays(cursor, 1);
      continue;
    }

    const matrix = await getPractitionerDayMatrix(dayStart);
    const row = matrix.resources.find((r) => r.code === input.practitionerCode);
    if (row) {
      const grid = matrix.slotMinutes;
      const need = Math.max(1, Math.ceil(durationMinutes / grid));
      const free = row.slots
        .map((s, idx) => ({ s, idx }))
        .filter(({ s }) => !s.occupied && !s.blocked && !s.lunch && !s.offShift);

      for (const { s, idx } of free) {
        let ok = true;
        for (let k = 1; k < need; k += 1) {
          const next = row.slots[idx + k];
          if (!next || next.occupied || next.blocked || next.lunch || next.offShift) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
        slots.push({
          scheduledAt: s.time,
          practitionerCode: row.code,
          practitionerName: row.name,
          durationMinutes,
        });
      }
    }

    if (cursor === last) break;
    cursor = addBakuDays(cursor, 1);
  }

  return {
    from: input.fromYmd,
    to: input.toYmd,
    durationMinutes,
    closedDays,
    slots,
  };
}