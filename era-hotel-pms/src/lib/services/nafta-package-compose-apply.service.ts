/**
 * Persist composed nightly sell into ReservationDailyRate for the stay.
 * Wave D — call after medical SKU stamp / check-in / stay amend.
 */

import { prisma } from "@/lib/prisma";
import { toDecimal } from "@/lib/decimal";
import {
  composeNaftaPackageNightlySellBreakdown,
  DEFAULT_NAFTA_PACKAGE_SELL,
  DEFAULT_STANDART_COMPANION_AZN,
  STANDART_COMPANION_COMPONENT_CODE,
  type ComposeBreakdown,
  type PackageSellRow,
} from "@/lib/services/nafta-package-compose.service";
import { MEDICAL_PACKAGE_CODES } from "@/lib/services/medical-package-resolve.service";

export async function resolveStandartCompanionAzn(
  asOf: Date = new Date(),
): Promise<number> {
  try {
    const { ensurePricingComponentsSeeded } = await import(
      "@/lib/services/pricing-components.service"
    );
    await ensurePricingComponentsSeeded();
    const row = await prisma.pricingComponent.findFirst({
      where: { code: STANDART_COMPANION_COMPONENT_CODE, active: true },
      include: {
        versions: { orderBy: { effectiveFrom: "desc" } },
      },
    });
    if (!row) return DEFAULT_STANDART_COMPANION_AZN;
    const on = new Date(
      Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()),
    );
    const ver =
      row.versions.find(
        (v) =>
          v.effectiveFrom <= on &&
          (v.effectiveTo == null || v.effectiveTo >= on),
      ) ?? row.versions[0];
    if (ver?.sellAmount != null) {
      return Number(ver.sellAmount);
    }
  } catch {
    /* seed/DB optional in unit tests */
  }
  return DEFAULT_STANDART_COMPANION_AZN;
}

/**
 * Load occ1/2/3 from RatePlanSellVersion for PKG-* when present; else DEFAULT_NAFTA_PACKAGE_SELL.
 */
export async function loadNaftaPackageSellCatalog(
  asOf: Date = new Date(),
): Promise<PackageSellRow[]> {
  const base = DEFAULT_NAFTA_PACKAGE_SELL.map((r) => ({ ...r }));
  try {
    const on = new Date(
      Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()),
    );
    const plans = await prisma.ratePlan.findMany({
      where: { code: { in: [...MEDICAL_PACKAGE_CODES] } },
      include: {
        sellVersions: { orderBy: { effectiveFrom: "desc" } },
      },
    });
    for (const plan of plans) {
      const row = base.find((r) => r.code === plan.code);
      if (!row) continue;
      for (const occ of [1, 2, 3] as const) {
        const ver = plan.sellVersions.find(
          (v) =>
            v.occupancy === occ &&
            v.effectiveFrom <= on &&
            (v.effectiveTo == null || v.effectiveTo >= on),
        );
        if (ver) {
          const price = Number(ver.sellPrice);
          if (occ === 1) row.occ1 = price;
          else if (occ === 2) row.occ2 = price;
          else row.occ3 = price;
        }
      }
    }
  } catch {
    /* unit tests / empty DB */
  }
  return base;
}

export async function previewComposedPackageSell(
  reservationId: string,
): Promise<ComposeBreakdown | null> {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: {
      medicalPackageCode: true,
      checkInDate: true,
      paxGuests: {
        select: { medicalPackageCode: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!reservation) return null;
  const companion = await resolveStandartCompanionAzn(reservation.checkInDate);
  const catalog = await loadNaftaPackageSellCatalog(reservation.checkInDate);
  const codes =
    reservation.paxGuests.length > 0
      ? reservation.paxGuests.map((g) => g.medicalPackageCode)
      : [reservation.medicalPackageCode];
  return composeNaftaPackageNightlySellBreakdown(codes, catalog, companion);
}

/**
 * Upsert dailyRates for each night with composed amount.
 * Skips when no resolved SKUs (null compose) — FO keeps manual / rate-plan sell.
 */
export async function syncComposedDailyRates(
  reservationId: string,
): Promise<{ applied: boolean; total: number | null; breakdown: ComposeBreakdown | null }> {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: {
      checkInDate: true,
      checkOutDate: true,
      medicalPackageCode: true,
      paxGuests: {
        select: { medicalPackageCode: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!reservation) {
    return { applied: false, total: null, breakdown: null };
  }
  const companion = await resolveStandartCompanionAzn(reservation.checkInDate);
  const catalog = await loadNaftaPackageSellCatalog(reservation.checkInDate);
  const codes =
    reservation.paxGuests.length > 0
      ? reservation.paxGuests.map((g) => g.medicalPackageCode)
      : [reservation.medicalPackageCode];
  const breakdown = composeNaftaPackageNightlySellBreakdown(
    codes,
    catalog,
    companion,
  );
  if (!breakdown) {
    return { applied: false, total: null, breakdown: null };
  }

  const nightsCount = Math.max(
    1,
    Math.round(
      (reservation.checkOutDate.getTime() - reservation.checkInDate.getTime()) /
        86_400_000,
    ),
  );
  for (let i = 0; i < nightsCount; i++) {
    const stayDate = new Date(reservation.checkInDate);
    stayDate.setUTCDate(stayDate.getUTCDate() + i);
    await prisma.reservationDailyRate.upsert({
      where: {
        reservationId_stayDate: { reservationId, stayDate },
      },
      create: {
        reservationId,
        stayDate,
        amount: toDecimal(breakdown.total),
        manualFlag: false,
      },
      update: {
        amount: toDecimal(breakdown.total),
      },
    });
  }
  return { applied: true, total: breakdown.total, breakdown };
}
