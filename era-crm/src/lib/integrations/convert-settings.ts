/**
 * P1-8 / early P0: conversion side-effect flags (stop hardcoding promo/booking forever).
 * Stored per org in CrmOrgSettings until a richer admin surface owns them.
 */
import { prisma } from "@/lib/prisma";

export type ConvertSideEffects = {
  createPromotion: boolean;
  promotionPercent: number;
  createBooking: boolean;
  bookingOffsetDays: number;
  createShipment: boolean;
  createPortalLink: boolean;
  createPaymentLink: boolean;
};

/** Opt-in defaults (TZ S4 / P1-8): do not create promo/booking unless admin enables. */
const DEFAULTS: ConvertSideEffects = {
  createPromotion: false,
  promotionPercent: 5,
  createBooking: false,
  bookingOffsetDays: 1,
  createShipment: false,
  createPortalLink: false,
  createPaymentLink: true,
};

export function readConvertSideEffects(
  rawJson?: string | null,
): ConvertSideEffects {
  if (!rawJson) return { ...DEFAULTS };
  try {
    return { ...DEFAULTS, ...(JSON.parse(rawJson) as Partial<ConvertSideEffects>) };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function loadConvertSideEffects(
  organizationId: string,
): Promise<ConvertSideEffects> {
  const row = await prisma.crmOrgSettings.findUnique({
    where: { organizationId },
  });
  return readConvertSideEffects(row?.convertSideEffectsJson);
}

export async function saveConvertSideEffects(
  organizationId: string,
  partial: Partial<ConvertSideEffects>,
): Promise<ConvertSideEffects> {
  const current = await loadConvertSideEffects(organizationId);
  const next: ConvertSideEffects = {
    ...current,
    ...partial,
    promotionPercent:
      partial.promotionPercent != null
        ? Math.min(100, Math.max(0, Number(partial.promotionPercent)))
        : current.promotionPercent,
    bookingOffsetDays:
      partial.bookingOffsetDays != null
        ? Math.min(30, Math.max(0, Math.floor(Number(partial.bookingOffsetDays))))
        : current.bookingOffsetDays,
  };
  await prisma.crmOrgSettings.upsert({
    where: { organizationId },
    create: {
      organizationId,
      convertSideEffectsJson: JSON.stringify(next),
    },
    update: {
      convertSideEffectsJson: JSON.stringify(next),
    },
  });
  return next;
}
