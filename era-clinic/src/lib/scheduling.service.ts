import { prisma } from "@/lib/prisma";

import { getDefaultTenant } from "@/domain/settings/settings.service";

const DEFAULT_SLOT_MINUTES_FALLBACK = 30;

async function resolveSlotMinutes(practitionerCode?: string): Promise<number> {
  if (!practitionerCode) {
    const tenant = await getDefaultTenant();
    return tenant.defaultAppointmentSlotMinutes ?? DEFAULT_SLOT_MINUTES_FALLBACK;
  }
  const practitioner = await prisma.practitioner.findFirst({
    where: { code: practitionerCode },
    select: { defaultSlotMinutes: true },
  });
  if (practitioner?.defaultSlotMinutes) return practitioner.defaultSlotMinutes;
  const tenant = await getDefaultTenant();
  return tenant.defaultAppointmentSlotMinutes ?? DEFAULT_SLOT_MINUTES_FALLBACK;
}

/** Overlap check for outpatient appointment create/reschedule. */
export async function detectSchedulingConflict(input: {
  practitionerCode: string;
  scheduledAt: Date;
  excludeAppointmentId?: string;
  resourceId?: string | null;
}): Promise<string | null> {
  const slotMinutes = await resolveSlotMinutes(input.practitionerCode);
  const start = new Date(input.scheduledAt);
  const end = new Date(start.getTime() + slotMinutes * 60_000);

  const conflict = await prisma.appointment.findFirst({
    where: {
      id: input.excludeAppointmentId ? { not: input.excludeAppointmentId } : undefined,
      practitioner: { code: input.practitionerCode },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      scheduledAt: { gte: start, lt: end },
    },
    select: { id: true },
  });
  if (conflict) return "Practitioner already booked at this time";

  if (input.resourceId) {
    const resourceConflict = await prisma.appointment.findFirst({
      where: {
        id: input.excludeAppointmentId ? { not: input.excludeAppointmentId } : undefined,
        resourceId: input.resourceId,
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        scheduledAt: { gte: start, lt: end },
      },
      select: { id: true },
    });
    if (resourceConflict) return "Resource already booked at this time";
  }

  return null;
}
