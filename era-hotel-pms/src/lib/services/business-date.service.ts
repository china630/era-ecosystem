import { bakuCivilUtcDate, todayBakuYmd } from '@era/satellite-kit/time';
import { prisma } from '@/lib/prisma';

function dateOnly(d: Date): Date {
  return bakuCivilUtcDate(d.toISOString().slice(0, 10));
}

function parseIntegrationSettings(json: string | null | undefined): {
  strictBusinessDateGate?: boolean;
} {
  if (!json) return {};
  try {
    return JSON.parse(json) as { strictBusinessDateGate?: boolean };
  } catch {
    return {};
  }
}

export async function getHotelProfile() {
  return prisma.hotelProfile.findFirst({ orderBy: { createdAt: 'asc' } });
}

export async function getCurrentBusinessDate(): Promise<Date> {
  const profile = await getHotelProfile();
  if (profile?.currentBusinessDate) {
    return dateOnly(profile.currentBusinessDate);
  }
  const openDay = await prisma.businessDay.findFirst({
    where: { status: 'OPEN' },
    orderBy: { date: 'desc' },
  });
  if (openDay) return dateOnly(openDay.date);
  return bakuCivilUtcDate(todayBakuYmd());
}

export async function isStrictBusinessDateGate(): Promise<boolean> {
  const profile = await getHotelProfile();
  const settings = parseIntegrationSettings(profile?.integrationSettingsJson);
  return settings.strictBusinessDateGate !== false;
}

/** The hotel date is set, but nobody created the day row yet. Open it. Night audit closes a day; it does not create today's row. */
export async function ensureCurrentBusinessDayOpen(): Promise<void> {
  const bizDate = await getCurrentBusinessDate();
  const existing = await prisma.businessDay.findFirst({ where: { date: bizDate } });
  if (existing) return;
  try {
    await prisma.businessDay.create({ data: { date: bizDate, status: 'OPEN' } });
  } catch {
    // Another request created the same organizationId+date row.
  }
}

export async function assertBusinessDayOpenForPosting(): Promise<void> {
  if (!(await isStrictBusinessDateGate())) return;

  const profile = await getHotelProfile();
  if (profile?.businessDateLocked) {
    throw new Error('Business date is locked during night audit');
  }

  const bizDate = await getCurrentBusinessDate();
  const ymd = bizDate.toISOString().slice(0, 10);
  let day = await prisma.businessDay.findFirst({ where: { date: bizDate } });
  if (!day) {
    await ensureCurrentBusinessDayOpen();
    day = await prisma.businessDay.findFirst({ where: { date: bizDate } });
  }
  if (!day || day.status !== 'OPEN') {
    throw new Error(
      `Business day ${ymd} is closed. Night audit already closed this day and did not roll the hotel date forward.`,
    );
  }
}

export async function advanceBusinessDate(): Promise<Date> {
  const current = await getCurrentBusinessDate();
  const next = new Date(current);
  next.setUTCDate(next.getUTCDate() + 1);

  await prisma.$transaction(async (tx) => {
    const existing = await tx.businessDay.findFirst({ where: { date: next } });
    if (!existing) {
      await tx.businessDay.create({ data: { date: next, status: 'OPEN' } });
    } else if (existing.status === 'CLOSED') {
      await tx.businessDay.update({
        where: { id: existing.id },
        data: { status: 'OPEN' },
      });
    }

    const profile = await tx.hotelProfile.findFirst({ orderBy: { createdAt: 'asc' } });
    if (profile) {
      await tx.hotelProfile.update({
        where: { id: profile.id },
        data: { currentBusinessDate: next, businessDateLocked: false },
      });
    }
  });

  return next;
}

export async function lockBusinessDateForAudit(): Promise<void> {
  const profile = await getHotelProfile();
  if (!profile) return;
  await prisma.hotelProfile.update({
    where: { id: profile.id },
    data: { businessDateLocked: true },
  });
}

export async function getBusinessDateStatus() {
  const profile = await getHotelProfile();
  const current = await getCurrentBusinessDate();
  const wall = bakuCivilUtcDate(todayBakuYmd());
  const lagDays = Math.round((wall.getTime() - current.getTime()) / 86400000);
  const day = await prisma.businessDay.findFirst({ where: { date: current } });

  return {
    currentBusinessDate: current.toISOString().slice(0, 10),
    wallClockDate: wall.toISOString().slice(0, 10),
    lagDays,
    businessDayStatus: day?.status ?? null,
    locked: profile?.businessDateLocked ?? false,
    strictGate: await isStrictBusinessDateGate(),
  };
}
