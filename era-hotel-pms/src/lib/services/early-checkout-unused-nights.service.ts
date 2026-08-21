import { prisma } from '@/lib/prisma';
import { decimalToNumber } from '@/lib/decimal';
import { addHotelDays, hotelDateKey } from '@/lib/hotel-calendar';
import { postCharge, postPayment, voidCharge } from '@/lib/services/folio.service';

const VAT_RATE = 0.18;
const LODGING_CODES = new Set(['ROOM', 'PKG', 'TREATMENT', 'BOARD', 'ACCOM']);

export type UnusedNightsChargePlan =
  | {
      kind: 'void';
      chargeId: string;
      folioId: string;
      folioType: string;
      amount: number;
      qty: number;
      revenueCode: string;
      businessDateKey: string | null;
      description: string;
    }
  | {
      kind: 'partial_lump';
      chargeId: string;
      folioId: string;
      folioType: string;
      voidAmount: number;
      remainingAmount: number;
      remainingQty: number;
      unitAmount: number;
      revenueCodeId: string;
      revenueCode: string;
      description: string;
    };

export type EarlyCheckoutPreview = {
  reservationId: string;
  applicable: boolean;
  unusedNights: number;
  unusedDates: string[];
  unusedSellGross: number;
  vatRate: number;
  vatWithheld: number;
  refundNet: number;
  /** Cash/card refund only on GUEST folios after reversal credit. */
  guestCashRefund: number;
  companyAgencyGrossReversed: number;
  defaultRefundMethod: 'CASH';
  chargePlans: UnusedNightsChargePlan[];
  warnings: string[];
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** House-favoring: floor refund net to 2 decimals. */
export function computeUnusedNightsRefund(unusedSellGross: number, vatRate = VAT_RATE) {
  const gross = roundMoney(Math.max(0, unusedSellGross));
  if (gross <= 0) {
    return { unusedSellGross: 0, vatWithheld: 0, refundNet: 0, vatRate };
  }
  const refundNet = Math.floor((gross / (1 + vatRate)) * 100) / 100;
  const vatWithheld = roundMoney(gross - refundNet);
  return { unusedSellGross: gross, vatWithheld, refundNet, vatRate };
}

function eachHotelNightKeys(fromKey: string, toKeyExclusive: string): string[] {
  const keys: string[] = [];
  let cursor = fromKey;
  while (cursor < toKeyExclusive) {
    keys.push(cursor);
    cursor = hotelDateKey(addHotelDays(cursor, 1));
  }
  return keys;
}

function isLodgingCode(code: string, packageCodes: Set<string>): boolean {
  return LODGING_CODES.has(code) || packageCodes.has(code);
}

/**
 * Preview unused-nights refund for early checkout (HOT-CO-04).
 * All folio types: reverse lodging on GUEST/COMPANY/AGENCY; cash refund only for GUEST credit path.
 */
export async function previewEarlyCheckoutUnusedNights(
  reservationId: string,
  opts?: { asOf?: Date },
): Promise<EarlyCheckoutPreview> {
  const asOf = opts?.asOf ?? new Date();
  const warnings: string[] = [];

  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      ratePlan: { include: { packageLines: { include: { revenueCode: true } } } },
      folios: {
        where: { status: 'OPEN' },
        include: {
          charges: { include: { revenueCode: true } },
          payments: true,
        },
      },
    },
  });

  if (!reservation) {
    throw new Error('Reservation not found');
  }

  const empty: EarlyCheckoutPreview = {
    reservationId,
    applicable: false,
    unusedNights: 0,
    unusedDates: [],
    unusedSellGross: 0,
    vatRate: VAT_RATE,
    vatWithheld: 0,
    refundNet: 0,
    guestCashRefund: 0,
    companyAgencyGrossReversed: 0,
    defaultRefundMethod: 'CASH',
    chargePlans: [],
    warnings,
  };

  if (reservation.status !== 'IN_HOUSE' && reservation.status !== 'CONFIRMED') {
    warnings.push(`Status ${reservation.status} — preview only meaningful for IN_HOUSE`);
  }

  const departureKey = hotelDateKey(asOf);
  const plannedOutKey = hotelDateKey(reservation.checkOutDate);
  if (departureKey >= plannedOutKey) {
    return empty;
  }

  const unusedDates = eachHotelNightKeys(departureKey, plannedOutKey);
  const unusedNights = unusedDates.length;
  if (unusedNights <= 0) return empty;

  const packageCodes = new Set(
    (reservation.ratePlan.packageLines ?? []).map((l) => l.revenueCode.code),
  );
  const medical = !!reservation.ratePlan.medicalFlag;
  const plannedNights = eachHotelNightKeys(
    hotelDateKey(reservation.checkInDate),
    plannedOutKey,
  ).length;

  const chargePlans: UnusedNightsChargePlan[] = [];
  let unusedSellGross = 0;
  let companyAgencyGrossReversed = 0;
  let guestGrossReversed = 0;

  for (const folio of reservation.folios) {
    for (const charge of folio.charges) {
      const code = charge.revenueCode.code;
      if (!isLodgingCode(code, packageCodes)) continue;

      const bizKey = charge.businessDate ? hotelDateKey(charge.businessDate) : null;
      const qty = charge.qty ?? 1;
      const lineTotal = roundMoney(decimalToNumber(charge.amount) * qty);

      // Nightly / dated lodging for unused dates
      if (bizKey && unusedDates.includes(bizKey)) {
        chargePlans.push({
          kind: 'void',
          chargeId: charge.id,
          folioId: folio.id,
          folioType: folio.type,
          amount: lineTotal,
          qty,
          revenueCode: code,
          businessDateKey: bizKey,
          description: charge.description,
        });
        unusedSellGross += lineTotal;
        if (folio.type === 'GUEST') guestGrossReversed += lineTotal;
        else companyAgencyGrossReversed += lineTotal;
        continue;
      }

      // Non-medical accommodation lump (qty > 1, not night-keyed to unused set)
      if (
        !medical &&
        code === 'ROOM' &&
        qty > 1 &&
        (!bizKey || !unusedDates.includes(bizKey))
      ) {
        const unit = roundMoney(decimalToNumber(charge.amount));
        const unusedQty = Math.min(unusedNights, qty);
        if (unusedQty <= 0) continue;
        // Only treat as lump if description looks like check-in accommodation
        const desc = (charge.description ?? '').toLowerCase();
        const looksLikeLump =
          desc.includes('accommodation') ||
          desc.includes('размещ') ||
          qty === plannedNights ||
          qty >= unusedNights;
        if (!looksLikeLump && bizKey) continue;

        const voidAmount = roundMoney(unit * unusedQty);
        const remainingQty = qty - unusedQty;
        const remainingAmount = roundMoney(unit * remainingQty);
        chargePlans.push({
          kind: 'partial_lump',
          chargeId: charge.id,
          folioId: folio.id,
          folioType: folio.type,
          voidAmount,
          remainingAmount,
          remainingQty,
          unitAmount: unit,
          revenueCodeId: charge.revenueCodeId,
          revenueCode: code,
          description: charge.description,
        });
        unusedSellGross += voidAmount;
        if (folio.type === 'GUEST') guestGrossReversed += voidAmount;
        else companyAgencyGrossReversed += voidAmount;
      }
    }
  }

  unusedSellGross = roundMoney(unusedSellGross);
  const money = computeUnusedNightsRefund(unusedSellGross);
  // Guest cash = refundNet proportional to guest share of unused gross
  const guestCashRefund =
    unusedSellGross > 0
      ? roundMoney((money.refundNet * guestGrossReversed) / unusedSellGross)
      : 0;

  return {
    reservationId,
    applicable: chargePlans.length > 0 && money.unusedSellGross > 0,
    unusedNights,
    unusedDates,
    unusedSellGross: money.unusedSellGross,
    vatRate: money.vatRate,
    vatWithheld: money.vatWithheld,
    refundNet: money.refundNet,
    guestCashRefund,
    companyAgencyGrossReversed: roundMoney(companyAgencyGrossReversed),
    defaultRefundMethod: 'CASH',
    chargePlans,
    warnings,
  };
}

/**
 * Apply unused-nights reversals + optional GUEST cash refund (idempotent-ish: voids by charge id).
 */
export async function applyEarlyCheckoutUnusedNights(
  reservationId: string,
  opts?: {
    asOf?: Date;
    refundMethod?: 'CASH' | 'CARD';
    reason?: string;
    preview?: EarlyCheckoutPreview;
  },
): Promise<EarlyCheckoutPreview & { applied: boolean; refundPaymentId?: string }> {
  const preview =
    opts?.preview ?? (await previewEarlyCheckoutUnusedNights(reservationId, { asOf: opts?.asOf }));
  if (!preview.applicable || preview.chargePlans.length === 0) {
    return { ...preview, applied: false };
  }

  for (const plan of preview.chargePlans) {
    if (plan.kind === 'void') {
      const still = await prisma.folioCharge.findUnique({ where: { id: plan.chargeId } });
      if (!still) continue;
      await voidCharge(plan.chargeId);
    } else {
      const still = await prisma.folioCharge.findUnique({
        where: { id: plan.chargeId },
        include: { folio: true },
      });
      if (!still || still.folio.status !== 'OPEN') continue;
      await voidCharge(plan.chargeId);
      if (plan.remainingQty > 0 && plan.remainingAmount > 0) {
        await postCharge({
          reservationId,
          revenueCodeId: plan.revenueCodeId,
          amount: plan.unitAmount,
          qty: plan.remainingQty,
          description: `${plan.description} (early CO remaining)`,
        });
      }
    }
  }

  let refundPaymentId: string | undefined;
  const method = opts?.refundMethod ?? 'CASH';
  if (preview.guestCashRefund > 0.009) {
    const guestFolio = await prisma.folio.findFirst({
      where: { reservationId, type: 'GUEST', status: 'OPEN' },
    });
    if (guestFolio) {
      const payment = await postPayment({
        folioId: guestFolio.id,
        amount: preview.guestCashRefund,
        paymentMethod: method,
        kind: 'REFUND',
        refundReason:
          opts?.reason?.trim() ||
          `Early checkout unused nights (${preview.unusedNights}n) net of ${(VAT_RATE * 100).toFixed(0)}% VAT`,
      });
      refundPaymentId = payment.id;
    }
  }

  return { ...preview, applied: true, refundPaymentId };
}
