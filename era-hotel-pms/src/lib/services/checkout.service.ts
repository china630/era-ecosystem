import { prisma } from '@/lib/prisma';
import { dispatchReservationCompleted } from '@/lib/integration/event-dispatcher';
import type { DispatchResult } from '@/lib/integration/event-types';
import { getOutboundSettings } from '@/lib/integration/integration-settings';
import {
  assertGuestFoliosZeroBalance,
  assertZeroBalance,
  closeFolios,
  folioBalance,
} from '@/lib/services/folio.service';
import { assertCanTransferToCityLedger } from '@/lib/services/city-ledger-gate.service';
import { createFiscalDocumentsOnCheckout, issueFolioInvoice } from '@/lib/services/fiscal-document.service';
import { getReservation } from '@/lib/services/reservation.service';
import { releaseDoorAfterShareDeparture } from '@/lib/services/share-assignment.service';

export interface CheckoutResult {
  reservation: Awaited<ReturnType<typeof getReservation>>;
  dispatch: DispatchResult;
  cityLedgerTransferred: string[];
}

export async function checkoutReservation(
  id: string,
  opts?: {
    transferToCityLedger?: boolean;
    discountAmount?: number;
    discountDescription?: string;
    unusedNightsRefundMethod?: 'CASH' | 'CARD';
    unusedNightsReason?: string;
  },
): Promise<CheckoutResult> {
  const existing = await getReservation(id);
  if (existing.status !== 'IN_HOUSE') {
    throw new Error('Check-out is only allowed for IN_HOUSE reservations');
  }

  const { postLateCheckOutFee } = await import('@/lib/services/early-late-fees.service');
  await postLateCheckOutFee(id).catch((e) => console.error('Late check-out fee failed', e));

  const { applyEarlyCheckoutUnusedNights } = await import(
    '@/lib/services/early-checkout-unused-nights.service'
  );
  await applyEarlyCheckoutUnusedNights(id, {
    refundMethod: opts?.unusedNightsRefundMethod ?? 'CASH',
    reason: opts?.unusedNightsReason,
  }).catch((e) => console.error('Early checkout unused-nights failed', e));

  if (opts?.discountAmount && opts.discountAmount > 0) {
    const { postDiscount } = await import('@/lib/services/folio.service');
    await postDiscount({
      reservationId: id,
      amount: opts.discountAmount,
      description: opts.discountDescription ?? 'Checkout discount',
    });
  }

  const { applyHeldDepositsToReservation } = await import('@/lib/services/folio-deposit.service');
  await applyHeldDepositsToReservation(id);

  const { refundRemainingDeposits } = await import('@/lib/services/folio-deposit.service');
  await refundRemainingDeposits(id);

  const settings = await getOutboundSettings();
  const openFolios = await prisma.folio.findMany({
    where: { reservationId: id, status: 'OPEN' },
    include: { charges: true, payments: true },
  });

  const arCandidates = openFolios.filter((f) => {
    if (f.type !== 'COMPANY' && f.type !== 'AGENCY') return false;
    return folioBalance(f.charges, f.payments) > 0.01;
  });

  const wantCl = opts?.transferToCityLedger !== false && arCandidates.length > 0;

  if (wantCl) {
    if (settings.requireZeroBalanceOnCheckout === false || wantCl) {
      await assertGuestFoliosZeroBalance(id);
      for (const f of arCandidates) {
        const bal = folioBalance(f.charges, f.payments);
        await assertCanTransferToCityLedger(id, f.id, bal);
      }
    }
  } else {
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
    if (completed.agencyId) {
      const asOf = new Date().toISOString().slice(0, 10);
      const { dispatchCityLedgerSnapshot } = await import('@/lib/integration/event-dispatcher');
      await dispatchCityLedgerSnapshot(completed.agencyId, asOf).catch((e) =>
        console.error('CL snapshot failed', e),
      );
    }
  }

  const dispatch = await dispatchReservationCompleted(completed);
  const { dispatchGuestCheckedOut } = await import('@/lib/integration/guest-lifecycle-events');
  void dispatchGuestCheckedOut({
    reservationId: id,
    roomNumber: completed.room?.roomNumber ?? undefined,
    programCode: completed.ratePlan.medicalFlag ? completed.ratePlan.code : undefined,
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

  return { reservation, dispatch, cityLedgerTransferred };
}
