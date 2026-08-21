import { prisma } from "@/lib/prisma";
import { getResourceCalendar } from "@/lib/procedure-scheduling.service";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import {
  SATELLITE_CLINIC_CAPACITY_CHANGED,
} from "@era/contracts";

import { assertCapacityBookingAllowed as assertCap } from "@/lib/capacity-booking-gates";

export const DEFAULT_DAILY_PROCEDURE_SLOTS = 1000;
export const PROCEDURES_PER_GUEST_WEEK = 8;
export const RISK_GUEST_WEEK_MIN = 120;
export const RISK_GUEST_WEEK_MAX = 125;

export type CapacityRiskLevel = "ok" | "warning" | "critical";

/** Deny medical-package booking when capacity risk is critical. */
export function assertCapacityBookingAllowed(summary: {
  bookingAllowed: boolean;
  riskLevel: CapacityRiskLevel;
}): void {
  assertCap(summary);
}

export type CapacitySummary = {
  weekStart: string;
  weekEnd: string;
  from: string;
  to: string;
  scheduledSlots: number;
  dailyCapacitySlots: number;
  proceduresPerGuestWeek: number;
  guestEquivalent: number;
  totalSlots: number;
  occupiedSlots: number;
  remainingSlots: number;
  remainingPct: number;
  warnPct: number;
  criticalPct: number;
  riskLevel: CapacityRiskLevel;
  riskBandMin: number;
  riskBandMax: number;
  bookingAllowed: boolean;
  message: string;
};

function startOfWeek(d: Date): Date {
  const out = new Date(d);
  const day = out.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  out.setDate(out.getDate() + diff);
  out.setHours(0, 0, 0, 0);
  return out;
}

function envPct(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/** Inventory remaining % over resource×slot grid for [from, to). */
export async function computeSlotInventory(from: Date, to: Date) {
  let totalSlots = 0;
  let occupiedSlots = 0;
  const resources = await prisma.resource.findMany({ select: { id: true, capacity: true } });
  const capById = new Map(resources.map((r) => [r.id, Math.max(1, r.capacity)]));

  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  while (cursor < to) {
    const day = new Date(cursor);
    const calendar = await getResourceCalendar(day);
    for (const row of calendar) {
      const cap = capById.get(row.resourceId) ?? 1;
      for (const slot of row.slots) {
        totalSlots += cap;
        if (slot.occupied) occupiedSlots += 1;
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  const remainingSlots = Math.max(0, totalSlots - occupiedSlots);
  const remainingPct =
    totalSlots > 0 ? Math.round((remainingSlots / totalSlots) * 1000) / 10 : 100;
  return { totalSlots, occupiedSlots, remainingSlots, remainingPct };
}

function buildMessage(summary: Omit<CapacitySummary, "message">): string {
  if (summary.riskLevel === "critical") {
    return `Clinic capacity exhausted for ${summary.from}…${summary.to}: ${summary.remainingPct}% slots left (${summary.remainingSlots}/${summary.totalSlots}). Medical package bookings blocked.`;
  }
  if (summary.riskLevel === "warning") {
    return `Clinic capacity low for ${summary.from}…${summary.to}: ${summary.remainingPct}% slots left (warn ≤${summary.warnPct}%). Prefer delaying new medical packages.`;
  }
  return `Clinic capacity OK for ${summary.from}…${summary.to}: ${summary.remainingPct}% slots remaining.`;
}

export async function getCapacitySummary(
  refDate = new Date(),
): Promise<CapacitySummary> {
  const dailyCapacitySlots = Number(
    process.env.CLINIC_DAILY_PROCEDURE_SLOTS ?? DEFAULT_DAILY_PROCEDURE_SLOTS,
  );
  const warnPct = envPct("CLINIC_CAPACITY_WARN_PCT", 15);
  const criticalPct = envPct("CLINIC_CAPACITY_CRITICAL_PCT", 0);

  const weekStart = startOfWeek(refDate);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const scheduledSlots = await prisma.procedureOrder.count({
    where: {
      scheduledAt: { gte: weekStart, lt: weekEnd },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
    },
  });

  const inventory = await computeSlotInventory(weekStart, weekEnd);
  const guestEquivalent = scheduledSlots / PROCEDURES_PER_GUEST_WEEK;

  let riskLevel: CapacityRiskLevel = "ok";
  if (
    inventory.remainingPct <= criticalPct ||
    guestEquivalent >= RISK_GUEST_WEEK_MAX
  ) {
    riskLevel = "critical";
  } else if (
    inventory.remainingPct <= warnPct ||
    guestEquivalent >= RISK_GUEST_WEEK_MIN
  ) {
    riskLevel = "warning";
  }

  const base = {
    weekStart: weekStart.toISOString().slice(0, 10),
    weekEnd: weekEnd.toISOString().slice(0, 10),
    from: weekStart.toISOString().slice(0, 10),
    to: weekEnd.toISOString().slice(0, 10),
    scheduledSlots,
    dailyCapacitySlots,
    proceduresPerGuestWeek: PROCEDURES_PER_GUEST_WEEK,
    guestEquivalent: Math.round(guestEquivalent * 10) / 10,
    totalSlots: inventory.totalSlots,
    occupiedSlots: inventory.occupiedSlots,
    remainingSlots: inventory.remainingSlots,
    remainingPct: inventory.remainingPct,
    warnPct,
    criticalPct,
    riskLevel,
    riskBandMin: RISK_GUEST_WEEK_MIN,
    riskBandMax: RISK_GUEST_WEEK_MAX,
    bookingAllowed: riskLevel !== "critical",
  };

  return { ...base, message: buildMessage(base) };
}

/** Publish capacity changed event when risk level differs from last published. */
export async function evaluateAndPublishCapacity(refDate = new Date()) {
  const summary = await getCapacitySummary(refDate);
  const tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });
  const prev = tenant?.lastCapacityRiskLevel ?? null;

  if (prev === summary.riskLevel) {
    return { summary, published: false };
  }

  if (tenant) {
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { lastCapacityRiskLevel: summary.riskLevel },
    });
  }

  await dispatchSatelliteEvent({
    type: SATELLITE_CLINIC_CAPACITY_CHANGED,
    payload: {
      from: summary.from,
      to: summary.to,
      riskLevel: summary.riskLevel,
      remainingPct: summary.remainingPct,
      remainingSlots: summary.remainingSlots,
      totalSlots: summary.totalSlots,
      occupiedSlots: summary.occupiedSlots,
      bookingAllowed: summary.bookingAllowed,
      guestEquivalent: summary.guestEquivalent,
      message: summary.message,
    },
  });

  return { summary, published: true };
}
