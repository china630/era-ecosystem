/**
 * Persist a package night from the sell grid into ReservationDailyRate.
 * Existing nights are left as stored. A missing cell does not invent a price.
 */

import { prisma } from "@/lib/prisma";
import { toDecimal } from "@/lib/decimal";
import { addHotelDays, hotelDateKey } from "@/lib/hotel-calendar";
import { bakuCivilUtcDate } from "@era/satellite-kit/time";
import {
  composeNaftaPackageNightlySellBreakdown,
  paxCodesForCompose,
  type ComposeBreakdown,
  type PackageSellCell,
} from "@/lib/services/nafta-package-compose.service";
import { MEDICAL_PACKAGE_CODES } from "@/lib/services/medical-package-resolve.service";

function stayDateUtc(asOf: Date): Date {
  return new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()));
}

function eachNight(checkIn: Date, checkOut: Date): Date[] {
  const nights: Date[] = [];
  let cursor = hotelDateKey(checkIn);
  const end = hotelDateKey(checkOut);
  while (cursor < end) {
    nights.push(bakuCivilUtcDate(cursor));
    cursor = addHotelDays(cursor, 1);
  }
  return nights;
}

export async function loadPackageSellCells(
  asOf: Date,
  mealPlanId?: string | null,
): Promise<PackageSellCell[]> {
  const on = stayDateUtc(asOf);
  const plans = await prisma.ratePlan.findMany({
    where: { code: { in: [...MEDICAL_PACKAGE_CODES] } },
    include: {
      sellVersions: {
        where: {
          roomTypeId: { not: null },
          effectiveFrom: { lte: on },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: on } }],
        },
        include: { roomType: { select: { code: true } } },
      },
    },
  });
  const cells: PackageSellCell[] = [];
  for (const plan of plans) {
    for (const ver of plan.sellVersions) {
      if (!ver.roomType) continue;
      if (mealPlanId && ver.mealPlanId && ver.mealPlanId !== mealPlanId) continue;
      if (mealPlanId && !ver.mealPlanId) continue;
      cells.push({
        code: plan.code,
        roomCode: ver.roomType.code,
        occupancy: ver.occupancy,
        amount: Number(ver.sellPrice),
      });
    }
  }
  return cells;
}

export async function ownerPackageNightlyBreakdown(
  asOf: Date,
  codes: string[],
  scope: { roomTypeId: string; mealPlanId?: string | null },
): Promise<ComposeBreakdown | null> {
  const packageCodes = codes.map((c) => c.trim().toUpperCase()).filter(Boolean);
  if (packageCodes.length === 0 || !scope.roomTypeId) return null;
  const roomType = await prisma.roomType.findUnique({
    where: { id: scope.roomTypeId },
    select: { code: true },
  });
  if (!roomType) return null;
  const cells = await loadPackageSellCells(asOf, scope.mealPlanId);
  return composeNaftaPackageNightlySellBreakdown(packageCodes, roomType.code, cells);
}

/**
 * Grid cell for this night, charged room type, meal, and guest packages.
 * Null when a required cell is missing. Does not read pricePerNight or +96.
 */
export async function ownerPackageNightlySell(
  asOf: Date,
  codes: string[],
  scope: { roomTypeId: string; mealPlanId?: string | null },
): Promise<number | null> {
  const breakdown = await ownerPackageNightlyBreakdown(asOf, codes, scope);
  return breakdown?.total ?? null;
}

export async function previewComposedPackageSell(
  reservationId: string,
): Promise<ComposeBreakdown | null> {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: {
      medicalPackageCode: true,
      checkInDate: true,
      roomTypeId: true,
      mealPlanId: true,
      ratePlan: { select: { code: true } },
      paxGuests: {
        select: {
          medicalPackageCode: true,
          firstName: true,
          lastName: true,
          guestId: true,
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!reservation) return null;
  const stayCode = reservation.ratePlan?.code ?? reservation.medicalPackageCode;
  const codes =
    reservation.paxGuests.length > 0
      ? paxCodesForCompose(reservation.paxGuests, stayCode)
      : [reservation.medicalPackageCode].filter((c): c is string => Boolean(c));
  return ownerPackageNightlyBreakdown(reservation.checkInDate, codes, {
    roomTypeId: reservation.roomTypeId,
    mealPlanId: reservation.mealPlanId,
  });
}

/**
 * Fill nights that have no daily rate yet. Stored nights, including fix and in-house, stay as they are.
 */
export async function syncComposedDailyRates(
  reservationId: string,
): Promise<{ applied: boolean; total: number | null; missing: boolean; breakdown: ComposeBreakdown | null }> {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: {
      checkInDate: true,
      checkOutDate: true,
      medicalPackageCode: true,
      roomTypeId: true,
      mealPlanId: true,
      ratePlan: { select: { code: true } },
      paxGuests: {
        select: {
          medicalPackageCode: true,
          firstName: true,
          lastName: true,
          guestId: true,
        },
        orderBy: { sortOrder: "asc" },
      },
      dailyRates: { select: { stayDate: true, amount: true } },
    },
  });
  if (!reservation) {
    return { applied: false, total: null, missing: false, breakdown: null };
  }
  const stayCode = reservation.ratePlan?.code ?? reservation.medicalPackageCode;
  const codes =
    reservation.paxGuests.length > 0
      ? paxCodesForCompose(reservation.paxGuests, stayCode)
      : [reservation.medicalPackageCode].filter((c): c is string => Boolean(c));
  const nights = eachNight(reservation.checkInDate, reservation.checkOutDate);
  let missing = false;
  let wrote = 0;
  let firstBreakdown: ComposeBreakdown | null = null;
  for (const stayDate of nights) {
    const stored = reservation.dailyRates.some(
      (d) => hotelDateKey(d.stayDate) === hotelDateKey(stayDate),
    );
    if (stored) continue;
    const breakdown = await ownerPackageNightlyBreakdown(stayDate, codes, {
      roomTypeId: reservation.roomTypeId,
      mealPlanId: reservation.mealPlanId,
    });
    if (!breakdown) {
      missing = true;
      continue;
    }
    if (!firstBreakdown) firstBreakdown = breakdown;
    await prisma.reservationDailyRate.create({
      data: {
        reservationId,
        stayDate,
        amount: toDecimal(breakdown.total),
        manualFlag: false,
        fixPrice: false,
      },
    });
    wrote += 1;
  }
  const rows = await prisma.reservationDailyRate.findMany({
    where: { reservationId },
    select: { amount: true },
  });
  const total = rows.reduce((sum, row) => sum + Number(row.amount), 0);
  if (wrote > 0 && !missing) {
    await prisma.reservation.update({
      where: { id: reservationId },
      data: { totalAmount: toDecimal(total) },
    });
  }
  return {
    applied: wrote > 0 && !missing,
    total: rows.length > 0 ? total : null,
    missing,
    breakdown: firstBreakdown,
  };
}
