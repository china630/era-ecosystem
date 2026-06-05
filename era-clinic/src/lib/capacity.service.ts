import { prisma } from "@/lib/prisma";

export const DEFAULT_DAILY_PROCEDURE_SLOTS = 1000;
export const PROCEDURES_PER_GUEST_WEEK = 8;
export const RISK_GUEST_WEEK_MIN = 120;
export const RISK_GUEST_WEEK_MAX = 125;

export type CapacityRiskLevel = "ok" | "warning" | "critical";

export type CapacitySummary = {
  weekStart: string;
  weekEnd: string;
  scheduledSlots: number;
  dailyCapacitySlots: number;
  proceduresPerGuestWeek: number;
  guestEquivalent: number;
  riskLevel: CapacityRiskLevel;
  riskBandMin: number;
  riskBandMax: number;
  bookingAllowed: boolean;
};

function startOfWeek(d: Date): Date {
  const out = new Date(d);
  const day = out.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  out.setDate(out.getDate() + diff);
  out.setHours(0, 0, 0, 0);
  return out;
}

export async function getCapacitySummary(
  refDate = new Date(),
): Promise<CapacitySummary> {
  const dailyCapacitySlots = Number(
    process.env.CLINIC_DAILY_PROCEDURE_SLOTS ?? DEFAULT_DAILY_PROCEDURE_SLOTS,
  );
  const weekStart = startOfWeek(refDate);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const scheduledSlots = await prisma.procedureOrder.count({
    where: {
      scheduledAt: { gte: weekStart, lt: weekEnd },
      status: { notIn: ["CANCELLED"] },
    },
  });

  const guestEquivalent = scheduledSlots / PROCEDURES_PER_GUEST_WEEK;
  let riskLevel: CapacityRiskLevel = "ok";
  if (guestEquivalent >= RISK_GUEST_WEEK_MAX) riskLevel = "critical";
  else if (guestEquivalent >= RISK_GUEST_WEEK_MIN) riskLevel = "warning";

  return {
    weekStart: weekStart.toISOString().slice(0, 10),
    weekEnd: weekEnd.toISOString().slice(0, 10),
    scheduledSlots,
    dailyCapacitySlots,
    proceduresPerGuestWeek: PROCEDURES_PER_GUEST_WEEK,
    guestEquivalent: Math.round(guestEquivalent * 10) / 10,
    riskLevel,
    riskBandMin: RISK_GUEST_WEEK_MIN,
    riskBandMax: RISK_GUEST_WEEK_MAX,
    bookingAllowed: riskLevel !== "critical",
  };
}
