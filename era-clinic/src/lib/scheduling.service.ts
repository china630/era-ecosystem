import { prisma } from "@/lib/prisma";

import { getDefaultTenant } from "@/domain/settings/settings.service";
import { requestOrganizationId } from "@/lib/request-organization";

const DEFAULT_SLOT_MINUTES_FALLBACK = 30;

async function resolveSlotMinutes(): Promise<number> {
  const tenant = await getDefaultTenant();
  return tenant.defaultAppointmentSlotMinutes ?? DEFAULT_SLOT_MINUTES_FALLBACK;
}

/** Length of a new reception: explicit minutes, else the visit service, else the clinic default. */
export async function resolveAppointmentDurationMinutes(input: {
  durationMinutes?: number | null;
  serviceCode?: string | null;
}): Promise<number> {
  if (input.durationMinutes != null && input.durationMinutes >= 5) {
    return Math.min(240, Math.floor(input.durationMinutes));
  }
  const code = input.serviceCode?.trim();
  if (code) {
    const procedureType = await prisma.procedureType.findFirst({
      where: { organizationId: requestOrganizationId(), code },
      select: { durationMin: true },
    });
    if (procedureType?.durationMin && procedureType.durationMin > 0) {
      return procedureType.durationMin;
    }
  }
  return resolveSlotMinutes();
}

/** Overlap check for outpatient appointment create/reschedule. */
export async function detectSchedulingConflict(input: {
  practitionerCode: string;
  scheduledAt: Date;
  durationMinutes: number;
  excludeAppointmentId?: string;
  resourceId?: string | null;
}): Promise<string | null> {
  const start = new Date(input.scheduledAt);
  const end = new Date(start.getTime() + input.durationMinutes * 60_000);
  const lookback = new Date(start.getTime() - 8 * 60 * 60_000);

  const overlaps = (
    rows: Array<{ scheduledAt: Date; durationMinutes: number }>,
  ) =>
    rows.some((row) => {
      const rowEnd = new Date(row.scheduledAt.getTime() + row.durationMinutes * 60_000);
      return row.scheduledAt < end && rowEnd > start;
    });

  const samePractitioner = await prisma.appointment.findMany({
    where: {
      id: input.excludeAppointmentId ? { not: input.excludeAppointmentId } : undefined,
      practitioner: { code: input.practitionerCode },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      scheduledAt: { gte: lookback, lt: end },
    },
    select: { scheduledAt: true, durationMinutes: true },
  });
  if (overlaps(samePractitioner)) return "Practitioner already booked at this time";

  if (input.resourceId) {
    const sameResource = await prisma.appointment.findMany({
      where: {
        id: input.excludeAppointmentId ? { not: input.excludeAppointmentId } : undefined,
        resourceId: input.resourceId,
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        scheduledAt: { gte: lookback, lt: end },
      },
      select: { scheduledAt: true, durationMinutes: true },
    });
    if (overlaps(sameResource)) return "Resource already booked at this time";
  }

  return null;
}
