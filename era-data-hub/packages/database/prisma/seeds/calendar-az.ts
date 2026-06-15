import type { PrismaClient } from "../../generated/client";

type CalendarDayType =
  | "working"
  | "weekend"
  | "holiday"
  | "transferred_rest"
  | "transferred_working"
  | "mourning"
  | "shortened";

type DaySpec = {
  isWorking: boolean;
  dayType: CalendarDayType;
  labelAz?: string;
  labelRu?: string;
  labelEn?: string;
};

/** Explicit AZ production calendar overrides (ISO date → spec). */
const EXPLICIT: Record<string, DaySpec> = {
  // —— 2026 holidays (Novruz block, national days) ——
  "2026-01-01": { isWorking: false, dayType: "holiday", labelEn: "New Year", labelAz: "Yeni il", labelRu: "Новый год" },
  "2026-01-02": { isWorking: false, dayType: "holiday", labelEn: "New Year", labelAz: "Yeni il", labelRu: "Новый год" },
  "2026-01-20": { isWorking: false, dayType: "holiday", labelEn: "Martyrs' Day", labelAz: "Qara Yanvar", labelRu: "День памяти" },
  "2026-03-08": { isWorking: false, dayType: "holiday", labelEn: "Women's Day", labelRu: "8 марта" },
  "2026-03-09": { isWorking: false, dayType: "transferred_rest", labelEn: "Rest day (transfer)" },
  "2026-03-20": { isWorking: false, dayType: "holiday", labelEn: "Novruz", labelAz: "Novruz" },
  "2026-03-21": { isWorking: false, dayType: "holiday", labelEn: "Novruz" },
  "2026-03-22": { isWorking: false, dayType: "holiday", labelEn: "Novruz" },
  "2026-03-23": { isWorking: false, dayType: "holiday", labelEn: "Novruz" },
  "2026-03-24": { isWorking: false, dayType: "holiday", labelEn: "Novruz" },
  "2026-03-25": { isWorking: false, dayType: "holiday", labelEn: "Novruz" },
  "2026-03-26": { isWorking: false, dayType: "holiday", labelEn: "Novruz" },
  "2026-03-27": { isWorking: false, dayType: "holiday", labelEn: "Novruz" },
  "2026-03-30": { isWorking: false, dayType: "transferred_rest", labelEn: "Rest day (transfer)" },
  "2026-05-09": { isWorking: false, dayType: "holiday", labelEn: "Victory Day", labelRu: "День Победы" },
  "2026-05-11": { isWorking: false, dayType: "transferred_rest", labelEn: "Rest day (transfer)" },
  "2026-05-27": { isWorking: false, dayType: "holiday", labelEn: "Republic Day" },
  "2026-05-28": { isWorking: false, dayType: "holiday", labelEn: "Republic Day" },
  "2026-05-29": { isWorking: false, dayType: "transferred_rest", labelEn: "Rest day (transfer)" },
  "2026-06-15": { isWorking: false, dayType: "holiday", labelEn: "National Salvation Day" },
  "2026-06-26": { isWorking: false, dayType: "holiday", labelEn: "Armed Forces Day" },
  "2026-11-08": { isWorking: false, dayType: "holiday", labelEn: "Victory Day" },
  "2026-11-09": { isWorking: false, dayType: "holiday", labelEn: "Flag Day" },
  "2026-11-10": { isWorking: false, dayType: "transferred_rest", labelEn: "Rest day (transfer)" },
  "2026-12-31": { isWorking: false, dayType: "holiday", labelEn: "World Azerbaijanis Solidarity Day" },
  // transferred working Saturdays (compensate long holiday blocks)
  "2026-01-17": { isWorking: true, dayType: "transferred_working", labelEn: "Transferred working day" },
  "2026-05-16": { isWorking: true, dayType: "transferred_working", labelEn: "Transferred working day" },
  "2026-12-26": { isWorking: true, dayType: "transferred_working", labelEn: "Transferred working day" },
  // shortened pre-holiday (policy: still working, ends 13:00 — HR uses isWorking=true)
  "2026-03-19": { isWorking: true, dayType: "shortened", labelEn: "Shortened working day (Novruz eve)" },
  // —— 2025 core holidays ——
  "2025-01-01": { isWorking: false, dayType: "holiday", labelEn: "New Year" },
  "2025-01-02": { isWorking: false, dayType: "holiday", labelEn: "New Year" },
  "2025-01-20": { isWorking: false, dayType: "holiday", labelEn: "Martyrs' Day" },
  "2025-03-20": { isWorking: false, dayType: "holiday", labelEn: "Novruz" },
  "2025-03-21": { isWorking: false, dayType: "holiday", labelEn: "Novruz" },
  "2025-03-22": { isWorking: false, dayType: "holiday", labelEn: "Novruz" },
  "2025-03-23": { isWorking: false, dayType: "holiday", labelEn: "Novruz" },
  "2025-03-24": { isWorking: false, dayType: "holiday", labelEn: "Novruz" },
  "2025-05-09": { isWorking: false, dayType: "holiday", labelEn: "Victory Day" },
  "2025-05-27": { isWorking: false, dayType: "holiday", labelEn: "Republic Day" },
  "2025-05-28": { isWorking: false, dayType: "holiday", labelEn: "Republic Day" },
  "2025-06-15": { isWorking: false, dayType: "holiday", labelEn: "National Salvation Day" },
  "2025-06-26": { isWorking: false, dayType: "holiday", labelEn: "Armed Forces Day" },
  "2025-11-09": { isWorking: false, dayType: "holiday", labelEn: "Flag Day" },
  "2025-12-31": { isWorking: false, dayType: "holiday", labelEn: "Solidarity Day" },
  "2025-01-18": { isWorking: true, dayType: "transferred_working", labelEn: "Transferred working day" },
  // —— 2027 / 2028 fixed holidays (extend as Cabinet publishes) ——
  "2027-01-01": { isWorking: false, dayType: "holiday", labelEn: "New Year" },
  "2027-01-02": { isWorking: false, dayType: "holiday", labelEn: "New Year" },
  "2027-03-20": { isWorking: false, dayType: "holiday", labelEn: "Novruz" },
  "2027-03-21": { isWorking: false, dayType: "holiday", labelEn: "Novruz" },
  "2027-03-22": { isWorking: false, dayType: "holiday", labelEn: "Novruz" },
  "2027-05-09": { isWorking: false, dayType: "holiday", labelEn: "Victory Day" },
  "2027-05-28": { isWorking: false, dayType: "holiday", labelEn: "Republic Day" },
  "2028-01-01": { isWorking: false, dayType: "holiday", labelEn: "New Year" },
  "2028-01-02": { isWorking: false, dayType: "holiday", labelEn: "New Year" },
  "2028-03-20": { isWorking: false, dayType: "holiday", labelEn: "Novruz" },
  "2028-03-21": { isWorking: false, dayType: "holiday", labelEn: "Novruz" },
  "2028-03-22": { isWorking: false, dayType: "holiday", labelEn: "Novruz" },
  "2028-05-09": { isWorking: false, dayType: "holiday", labelEn: "Victory Day" },
  "2028-05-28": { isWorking: false, dayType: "holiday", labelEn: "Republic Day" },
};

function isoUtc(y: number, m0: number, d: number): string {
  return `${y}-${String(m0 + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function defaultDaySpec(iso: string): DaySpec {
  const d = new Date(`${iso}T12:00:00.000Z`);
  const dow = d.getUTCDay();
  if (dow === 0 || dow === 6) {
    return { isWorking: false, dayType: "weekend" };
  }
  return { isWorking: true, dayType: "working" };
}

function resolveDay(iso: string): DaySpec {
  return EXPLICIT[iso] ?? defaultDaySpec(iso);
}

export async function seedCalendarAz(
  prisma: PrismaClient,
  years: number[] = [2025, 2026, 2027, 2028],
): Promise<void> {
  for (const year of years) {
    for (let m = 0; m < 12; m++) {
      const daysInMonth = new Date(Date.UTC(year, m + 1, 0)).getUTCDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const iso = isoUtc(year, m, d);
        const spec = resolveDay(iso);
        const date = new Date(`${iso}T12:00:00.000Z`);
        await prisma.calendarDay.upsert({
          where: { country_date: { country: "AZ", date } },
          create: {
            country: "AZ",
            date,
            isWorking: spec.isWorking,
            dayType: spec.dayType,
            labelAz: spec.labelAz ?? null,
            labelRu: spec.labelRu ?? null,
            labelEn: spec.labelEn ?? null,
            source: "az-production-calendar",
          },
          update: {
            isWorking: spec.isWorking,
            dayType: spec.dayType,
            labelAz: spec.labelAz ?? null,
            labelRu: spec.labelRu ?? null,
            labelEn: spec.labelEn ?? null,
          },
        });
      }
    }
  }
}

/** @deprecated use seedCalendarAz */
export async function seedCalendarAz2026(prisma: PrismaClient): Promise<void> {
  await seedCalendarAz(prisma, [2026]);
}
