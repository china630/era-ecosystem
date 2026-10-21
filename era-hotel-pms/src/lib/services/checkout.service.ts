import { todayBakuYmd } from '@era/satellite-kit/time';
import { hotelDateKey, stayCheckOut } from '@/lib/hotel-calendar';
import { decimalToNumber, toDecimal } from '@/lib/decimal';
import { earlyReversalByFolio } from '@/lib/early-checkout-reversal';
import { prisma } from '@/lib/prisma';
import { dispatchReservationCompleted } from '@/lib/integration/event-dispatcher';
import type { DispatchResult } from '@/lib/integration/event-types';
import {
  assertGuestFoliosZeroBalance,
  assertZeroBalance,
  closeFolios,
  folioBalance,
} from '@/lib/services/folio.service';
import { assertCanTransferToCityLedger } from '@/lib/services/city-ledger-gate.service';
import { createFiscalDocumentsOnCheckout, issueFolioInvoice } from '@/lib/services/fiscal-document.service';
import { getReservation } from '@/lib/services/reservation.service';
import {
  clinicProgramCodeFromTariff,
  usesMedicalPackageCompose,
} from '@/lib/services/medical-package-resolve.service';
import { releaseDoorAfterShareDeparture } from '@/lib/services/share-assignment.service';

export interface CheckoutResult {
  reservation: Awaited<ReturnType<typeof getReservation>>;
  dispatch: DispatchResult;
  cityLedgerTransferred: string[];
  depositRemainder: Awaited<
    ReturnType<typeof import('@/lib/services/folio-deposit.service').refundRemainingDeposits>
  >;
}

type FolioWithLines = {
  id?: string;
  type: string;
  charges: Parameters<typeof folioBalance>[0];
  payments: Parameters<typeof folioBalance>[1];
};

/** Open agency/company folios that still owe money. */
function payerDebtFolios<T extends FolioWithLines>(folios: T[]): T[] {
  return folios.filter(
    (f) => (f.type === 'COMPANY' || f.type === 'AGENCY') && folioBalance(f.charges, f.payments) > 0.01,
  );
}

/**
 * Payer debt never moves to City Ledger by default. The desk pays it or picks City Ledger explicitly.
 * `pendingReversal` is lodging that early checkout voids later in the same check-out.
 */
export function assertPayerDebtResolved(
  folios: FolioWithLines[],
  transferToCityLedger: boolean | undefined,
  pendingReversal: Record<string, number> = {},
) {
  if (transferToCityLedger === true) return;
  const owed = folios
    .filter((f) => f.type === 'COMPANY' || f.type === 'AGENCY')
    .map((f) => folioBalance(f.charges, f.payments) - (f.id ? (pendingReversal[f.id] ?? 0) : 0))
    .filter((bal) => bal > 0.01)
    .reduce((s, bal) => s + bal, 0);
  if (owed <= 0.01) return;
  throw Object.assign(
    new Error(
      `Agency or company folio still owes ${owed.toFixed(2)} AZN. Take payment on that folio or transfer it to City Ledger.`,
    ),
    { status: 409, code: 'PAYER_DEBT_UNRESOLVED' },
  );
}

export async function checkoutReservation(
  id: string,
  opts?: {
    transferToCityLedger?: boolean;
    transferToGuestDebt?: boolean;
    guestDebtNote?: string;
    createdByUserId?: string;
    discountAmount?: number;
    discountDescription?: string;
    unusedNightsRefundMethod?: 'CASH' | 'CARD';
    unusedNightsBankTerminalId?: string;
    unusedNightsReason?: string;
    procedureCreditRefundMethod?: 'CASH' | 'CARD';
    procedureCreditBankTerminalId?: string;
    auditRequest?: Request;
  },
): Promise<CheckoutResult> {
  const existing = await getReservation(id);
  if (usesMedicalPackageCompose(existing.ratePlan)) {
    const { assertClinicCheckoutClear } = await import('@/lib/integration/clinic-checkout-gate');
    await assertClinicCheckoutClear(id);
  }
  if (existing.status !== 'IN_HOUSE') {
    throw new Error('Check-out is only allowed for IN_HOUSE reservations');
  }

  const { assertNoOpenLaundry } = await import('@/lib/services/hk-nafta.service');
  await assertNoOpenLaundry(id);

  const { applyEarlyCheckoutUnusedNights, previewEarlyCheckoutUnusedNights } = await import(
    '@/lib/services/early-checkout-unused-nights.service'
  );
  const earlyPreview = await previewEarlyCheckoutUnusedNights(id).catch(() => null);

  assertPayerDebtResolved(
    await prisma.folio.findMany({
      where: { reservationId: id, status: 'OPEN', type: { in: ['AGENCY', 'COMPANY'] } },
      include: { charges: true, payments: true },
    }),
    opts?.transferToCityLedger,
    earlyPreview?.applicable ? earlyReversalByFolio(earlyPreview.chargePlans) : {},
  );

  const { postLateCheckOutFee } = await import('@/lib/services/early-late-fees.service');
  await postLateCheckOutFee(id).catch((e) => console.error('Late check-out fee failed', e));

  await applyEarlyCheckoutUnusedNights(id, {
    refundMethod: opts?.unusedNightsRefundMethod ?? 'CASH',
    bankTerminalId: opts?.unusedNightsBankTerminalId,
    reason: opts?.unusedNightsReason,
    preview: earlyPreview ?? undefined,
  }).catch((e) => console.error('Early checkout unused-nights failed', e));

  const todayKey = todayBakuYmd();
  if (hotelDateKey(existing.checkOutDate) > todayKey) {
    await prisma.reservation.update({
      where: { id },
      data: { checkOutDate: stayCheckOut(todayKey) },
    });
    await prisma.reservationDailyRate.deleteMany({
      where: { reservationId: id, stayDate: { gte: stayCheckOut(todayKey) } },
    });
    const summed = await prisma.reservationDailyRate.aggregate({
      where: { reservationId: id },
      _sum: { amount: true },
    });
    await prisma.reservation.update({
      where: { id },
      data: {
        totalAmount: toDecimal(
          summed._sum.amount == null ? 0 : decimalToNumber(summed._sum.amount),
        ),
      },
    });
  }

  if (opts?.discountAmount && opts.discountAmount > 0) {
    const { postDiscount } = await import('@/lib/services/folio.service');
    await postDiscount({
      reservationId: id,
      amount: opts.discountAmount,
      description: opts.discountDescription ?? 'Checkout discount',
      audit: { userId: opts.createdByUserId, request: opts.auditRequest },
    });
  }

  const { applyHeldDepositsToReservation } = await import('@/lib/services/folio-deposit.service');
  await applyHeldDepositsToReservation(id, {
    userId: opts?.createdByUserId,
    request: opts?.auditRequest,
  });

  const { refundRemainingDeposits } = await import('@/lib/services/folio-deposit.service');
  const depositRemainder = await refundRemainingDeposits(id);

  const openFolios = await prisma.folio.findMany({
    where: { reservationId: id, status: 'OPEN' },
    include: { charges: true, payments: true },
  });

  const arCandidates = payerDebtFolios(openFolios);
  assertPayerDebtResolved(openFolios, opts?.transferToCityLedger);
  const wantCl = opts?.transferToCityLedger === true && arCandidates.length > 0;

  if (opts?.transferToGuestDebt) {
    const note = opts.guestDebtNote?.trim() ?? '';
    if (!note) throw new Error('GUEST_DEBT_NOTE_REQUIRED');
    const stay = await prisma.reservation.findUnique({
      where: { id },
      select: { guestId: true },
    });
    if (!stay) throw new Error('Reservation not found');
    const { postPayment } = await import('@/lib/services/folio.service');
    const posted: Array<{ folioId: string; amount: number }> = [];
    for (const folio of openFolios) {
      if (folio.type !== 'GUEST') continue;
      const bal = folioBalance(folio.charges, folio.payments);
      if (bal <= 0.01) continue;
      const amount = Math.round(bal * 100) / 100;
      await postPayment({
        folioId: folio.id,
        amount,
        paymentMethod: 'GUEST_DEBT',
        createdByUserId: opts.createdByUserId,
      });
      await prisma.guestDebtEntry.create({
        data: {
          organizationId: folio.organizationId,
          reservationId: id,
          guestId: stay.guestId,
          amount: toDecimal(amount),
          note,
          createdByUserId: opts.createdByUserId ?? null,
        },
      });
      posted.push({ folioId: folio.id, amount });
    }
    const { recordReservationAudit } = await import('@/lib/reservation-audit');
    await recordReservationAudit(id, 'GUEST_DEBT', {
      userId: opts.createdByUserId,
      request: opts.auditRequest,
    }, {
      section: 'folio',
      source: 'user',
      fields: [
        { key: 'amount', from: null, to: String(posted.reduce((sum, row) => sum + row.amount, 0)) },
        { key: 'reason', from: null, to: note },
      ],
    });
  }

  if (wantCl) {
    await assertGuestFoliosZeroBalance(id);
    for (const f of arCandidates) {
      const bal = folioBalance(f.charges, f.payments);
      await assertCanTransferToCityLedger(id, f.id, bal);
    }
  } else {
    const { refundGuestCredit } = await import('@/lib/services/folio-credit-refund');
    await refundGuestCredit(id, {
      method: opts?.procedureCreditRefundMethod,
      bankTerminalId: opts?.procedureCreditBankTerminalId,
      reason: 'Paid procedure removed before checkout',
    });
    await assertZeroBalance(id);
  }

  const cityLedgerTransferred: string[] = [];

  const completed = await prisma.$transaction(async (tx) => {
    await closeFolios(id, { onlyTypes: ['GUEST'], targetStatus: 'CLOSED' });

    for (const f of openFolios.filter((x) => x.type === 'COMPANY' || x.type === 'AGENCY')) {
      const bal = folioBalance(f.charges, f.payments);
      if (Math.abs(bal) <= 0.01) {
        await tx.folio.update({ where: { id: f.id }, data: { status: 'CLOSED' } });
      } else if (wantCl) {
        await tx.folio.update({ where: { id: f.id }, data: { status: 'PENDING_AR' } });
      }
    }

    const reservation = await tx.reservation.update({
      where: { id },
      data: { status: 'CHECKED_OUT' },
      include: {
        room: { include: { roomType: true } },
        guest: true,
        ratePlan: true,
        agency: true,
        folios: {
          include: {
            charges: { include: { revenueCode: true } },
            payments: true,
          },
        },
      },
    });

    await tx.stay.updateMany({
      where: { reservationId: id },
      data: { actualCheckOut: new Date() },
    });

    if (reservation.roomId) {
      await releaseDoorAfterShareDeparture(tx, {
        roomId: reservation.roomId,
        excludeReservationId: id,
        shareBedIndex: reservation.shareBedIndex,
        wasInHouse: true,
      });
    }

    return reservation;
  });

  if (wantCl) {
    const pending = await prisma.folio.findMany({
      where: { reservationId: id, status: 'PENDING_AR' },
    });
    for (const f of pending) {
      await prisma.folio.update({ where: { id: f.id }, data: { status: 'TRANSFERRED_AR' } });
      cityLedgerTransferred.push(f.id);
      await issueFolioInvoice(f.id).catch((e) => console.error('CL invoice issue failed', e));
    }
    const asOf = todayBakuYmd();
    const { dispatchCityLedgerSnapshot, dispatchCompanyCityLedgerSnapshot } = await import(
      '@/lib/integration/event-dispatcher'
    );
    if (completed.agencyId && pending.some((folio) => folio.type === 'AGENCY')) {
      await dispatchCityLedgerSnapshot(completed.agencyId, asOf).catch((e) =>
        console.error('CL snapshot failed', e),
      );
    }
    if (completed.companyId && pending.some((folio) => folio.type === 'COMPANY')) {
      await dispatchCompanyCityLedgerSnapshot(completed.companyId, asOf).catch((e) =>
        console.error('Company CL snapshot failed', e),
      );
    }
  }

  const dispatch = await dispatchReservationCompleted(completed);
  const { dispatchGuestCheckedOut } = await import('@/lib/integration/guest-lifecycle-events');
  void dispatchGuestCheckedOut({
    reservationId: id,
    roomNumber: completed.room?.roomNumber ?? undefined,
    programCode: clinicProgramCodeFromTariff(completed.ratePlan),
  }).catch((e) => console.error('Guest lifecycle check-out failed', e));
  const { notifyFbPosReservationLifecycle } = await import('@/lib/integration/fnb-pos-webhook');
  void notifyFbPosReservationLifecycle({
    eventType: 'reservation_checked_out',
    reservationId: id,
    roomNumber: completed.room?.roomNumber ?? null,
    timestamp: new Date().toISOString(),
  });
  await createFiscalDocumentsOnCheckout(id);
  const { submitTourismCheckOut } = await import('@/lib/services/tourism.service');
  void submitTourismCheckOut(id).catch((e) => console.error('Tourism check-out failed', e));
  const reservation = await getReservation(id);
  const { recordReservationAudit } = await import('@/lib/reservation-audit');
  await recordReservationAudit(id, 'CHECK_OUT', {
    userId: opts?.createdByUserId,
    request: opts?.auditRequest,
  }, {
    section: 'status',
    source: 'user',
    fields: [
      { key: 'status', from: 'IN_HOUSE', to: 'CHECKED_OUT' },
      ...(opts?.transferToGuestDebt ? [{ key: 'guestDebt', from: null, to: opts.guestDebtNote ?? 'yes' }] : []),
      ...(opts?.transferToCityLedger ? [{ key: 'cityLedger', from: null, to: 'true' }] : []),
    ],
  });

  return { reservation, dispatch, cityLedgerTransferred, depositRemainder };
}
