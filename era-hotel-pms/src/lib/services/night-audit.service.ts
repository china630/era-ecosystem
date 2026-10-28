import { bakuDayBounds } from '@era/satellite-kit/time';
import { hotelDateKey } from '@/lib/hotel-calendar';
import { prisma } from '@/lib/prisma';
import { requestOrganizationId } from '@/lib/request-organization';
import { decimalToNumber, toDecimal } from '@/lib/decimal';
import type { ReservationStatus } from '@prisma/client';
import { postCharge } from '@/lib/services/folio.service';
import { roomChargeNote } from '@/lib/folio-charge-note';
import { requireRevenueCodeByRole } from '@/lib/revenue-code-token';
import { dispatchNightAuditClosed } from '@/lib/integration/event-dispatcher';
import { assertNoOpenPosShifts, getPosShiftStatus } from '@/lib/services/pms-bridge.service';
import { withNightAuditPosting } from '@/lib/night-audit-posting';
import {
  getCurrentBusinessDate,
  advanceBusinessDate,
  lockBusinessDateForAudit,
  unlockBusinessDateAfterAudit,
  ensureCurrentBusinessDayOpen,
} from '@/lib/services/business-date.service';
import {
  getNightlyRoomChargeForDate,
  NightlyPriceMissingError,
} from '@/lib/services/pricing-quote.service';
import { getPendingSummary, assertNoOpenPendingForNightAudit } from '@/lib/services/settlement-hub.service';
import { countUnclosedCashDesk } from '@/lib/services/cash-desk.service';
import {
  assertFinanceQaimeDayClose,
  fetchQaimeDayClose,
  QaimeDayCloseBlockedError,
  QaimeDayCloseUnreachableError,
  type QaimeDayGap,
} from '@/lib/services/qaime-day-close-gate';
import { resolveSettlementPolicy } from '@era/satellite-kit';
import { packageSkipPostsRoom, postsStayAsPackage } from '@/lib/services/medical-package-resolve.service';

export async function getNightAuditStatus() {
  await ensureCurrentBusinessDayOpen();
  const { findOpenCashShift } = await import('@/lib/services/cash-shift.service');
  const openShift = await findOpenCashShift();
  const posShiftStatus = await getPosShiftStatus();
  const currentBiz = await getCurrentBusinessDate();
  const businessDay = await prisma.businessDay.findFirst({
    where: { date: currentBiz },
    include: { nightRuns: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });
  const inHouseCount = await prisma.reservation.count({ where: { status: 'IN_HOUSE' } });
  const pendingSummary = await getPendingSummary(currentBiz);
  const { getBusinessDateStatus } = await import('@/lib/services/business-date.service');
  const bizStatus = await getBusinessDateStatus();
  const orgId = requestOrganizationId();
  const settlementPolicy = orgId
    ? await resolveSettlementPolicy(orgId)
    : { pendingSettlementNaPolicy: 'BLOCK' as const };

  const { start: dayStart, end: dayEnd } = bakuDayBounds(hotelDateKey(currentBiz));
  const unassignedArrivals = await prisma.reservation.count({
    where: {
      status: { in: ['CONFIRMED', 'OPTION'] },
      checkInDate: { gte: dayStart, lt: dayEnd },
      roomId: null,
    },
  });
  const unclosedCashRows = await countUnclosedCashDesk(hotelDateKey(currentBiz));
  const qaimeDayClose = await readQaimeDayCloseForStatus(hotelDateKey(currentBiz));
  const deskHold = await listNightAuditDeskHolds(currentBiz);

  return {
    openShift,
    posShiftStatus,
    businessDay,
    lastRun: businessDay?.nightRuns[0] ?? null,
    inHouseCount,
    businessDate: bizStatus,
    pendingSettlement: {
      count: pendingSummary.pendingCount,
      policy: settlementPolicy.pendingSettlementNaPolicy,
    },
    polishPreview: {
      unassignedArrivals,
      noShowCandidates: deskHold.missedCount,
    },
    deskHold,
    unclosedCashRows,
    qaimeDayClose,
  };
}

async function readQaimeDayCloseForStatus(businessDate: string): Promise<{
  enabled: boolean;
  unreachable: boolean;
  gaps: QaimeDayGap[];
}> {
  try {
    const answer = await fetchQaimeDayClose(businessDate);
    return { enabled: answer.enabled, unreachable: false, gaps: answer.enabled ? answer.gaps : [] };
  } catch (err) {
    if (err instanceof QaimeDayCloseBlockedError) {
      return { enabled: true, unreachable: false, gaps: err.gaps };
    }
    if (err instanceof QaimeDayCloseUnreachableError) {
      return { enabled: false, unreachable: true, gaps: [] };
    }
    return { enabled: false, unreachable: true, gaps: [] };
  }
}

function money2(value: number): number {
  return Math.round(value * 100) / 100;
}

type QtyPurpose = 'sale' | 'house_use' | 'comp' | 'housekeeping' | 'procedure_consumable';

function vatRateOf(taxTag: string | null, systemRole: string | null): number {
  if (systemRole === 'CITY_TAX') return 0;
  const parsed = Number(String(taxTag ?? '').replace('%', '').trim());
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return parsed;
}

function purposeForCharge(billingMode: string | null | undefined, amount: number): QtyPurpose {
  if (billingMode === 'HOUSE') return 'house_use';
  if (billingMode === 'COMP' && amount === 0) return 'comp';
  return 'sale';
}

/** Money and quantity are separate. A zero amount drops revenue only. */
async function collectDayDocument(date: Date) {
  const charges = await prisma.folioCharge.findMany({
    where: { businessDate: date },
    include: {
      revenueCode: true,
      folio: { select: { reservation: { select: { billingMode: true } } } },
    },
  });
  const pending = await prisma.settlementPendingCharge.findMany({
    where: { status: 'PAID', businessDate: date },
  });
  const payments = await prisma.folioPayment.findMany({
    where: { businessDate: date },
    include: {
      folio: { select: { reservation: { select: { company: { select: { voen: true } } } } } },
    },
  });

  const moneyByCode = new Map<string, { revenueCode: string; amount: number; vatRate: number }>();
  const addMoney = (revenueCode: string, amount: number, vatRate: number) => {
    const rounded = money2(amount);
    if (rounded === 0) return;
    const code = revenueCode.trim();
    const row = moneyByCode.get(code) ?? { revenueCode: code, amount: 0, vatRate };
    row.amount = money2(row.amount + rounded);
    moneyByCode.set(code, row);
  };
  const qtyByKey = new Map<
    string,
    { sku: string; qty: number; warehouseCode: string; purpose: QtyPurpose }
  >();
  const addQty = (
    sku: string | null | undefined,
    qty: number,
    warehouseCode: string | null | undefined,
    purpose: QtyPurpose,
  ) => {
    const trimmed = sku?.trim();
    if (!trimmed || qty === 0) return;
    const warehouse = warehouseCode?.trim() ?? '';
    const key = `${trimmed.toLowerCase()}|${purpose}|${warehouse}`;
    const row = qtyByKey.get(key) ?? { sku: trimmed, qty: 0, warehouseCode: warehouse, purpose };
    row.qty += qty;
    qtyByKey.set(key, row);
  };

  for (const charge of charges) {
    const amount = money2(decimalToNumber(charge.amount) * charge.qty);
    addMoney(charge.revenueCode.code, amount, vatRateOf(charge.revenueCode.taxTag, charge.revenueCode.systemRole));
    addQty(
      charge.sku,
      charge.stockQty,
      charge.warehouseCode,
      purposeForCharge(charge.folio.reservation.billingMode, amount),
    );
  }
  for (const row of pending) {
    const amount = money2(decimalToNumber(row.amount));
    const code = row.revenueCode?.trim() || 'UNKNOWN';
    addMoney(code, amount, 0);
    addQty(row.sku, row.qty, '', 'sale');
  }
  const housekeeping = await prisma.hkConsumption.findMany({ where: { businessDate: date } });
  for (const row of housekeeping) {
    addQty(row.sku, decimalToNumber(row.qty), '', 'housekeeping');
  }
  const internal = await prisma.internalConsumption.findMany({ where: { businessDate: date } });
  for (const row of internal) {
    const purpose: QtyPurpose = row.source === 'clinic' ? 'procedure_consumable' : 'housekeeping';
    addQty(row.sku, decimalToNumber(row.qty), row.warehouseCode, purpose);
  }

  const moneyLines = [...moneyByCode.values()].filter((line) => line.amount !== 0);
  const qtyLines = [...qtyByKey.values()].filter((line) => line.qty !== 0);

  const payByMethod = new Map<string, { method: string; amount: number; bankTerminalId?: string; population?: boolean }>();
  const addPay = (method: string, signed: number, bankTerminalId?: string | null, population = false) => {
    const name = method.trim() || 'CASH';
    const bank = name === 'CARD' ? bankTerminalId?.trim() || undefined : undefined;
    const guestCard = name === 'CARD' && population;
    const key = `${name}|${bank ?? ''}|${guestCard ? 'pop' : 'other'}`;
    const row = payByMethod.get(key) ?? {
      method: name,
      amount: 0,
      ...(bank ? { bankTerminalId: bank } : {}),
      ...(guestCard ? { population: true } : {}),
    };
    row.amount = money2(row.amount + signed);
    payByMethod.set(key, row);
  };
  for (const payment of payments) {
    const amount = decimalToNumber(payment.amount);
    const voen = payment.folio.reservation.company?.voen?.trim();
    addPay(
      payment.paymentMethod,
      payment.kind === 'REFUND' ? -amount : amount,
      payment.bankTerminalId,
      payment.paymentMethod === 'CARD' && !voen,
    );
  }
  for (const row of pending) {
    addPay(row.paymentMethod?.trim() || 'CASH', decimalToNumber(row.amount));
  }
  const paymentLines = [...payByMethod.values()].filter((row) => row.amount !== 0);

  const receipts = await prisma.folioDeposit.findMany({
    where: { businessDate: date },
    include: { reservation: { select: { company: { select: { voen: true } } } } },
  });
  const depositReceiptLines = receipts.map((row) => ({
    amount: money2(decimalToNumber(row.amount)),
    method: row.paymentMethod,
    population: row.paymentMethod === 'CARD' && !row.reservation.company?.voen?.trim(),
  }));
  const day = bakuDayBounds(hotelDateKey(date));
  const inDay = { gte: day.start, lt: day.end };
  const payouts = await prisma.folioDeposit.findMany({
    where: { status: 'REFUNDED', refundedAt: inDay },
    include: { reservation: { select: { company: { select: { voen: true } } } } },
  });
  const depositPayoutLines = payouts.map((row) => ({
    amount: money2(decimalToNumber(row.amount)),
    method: row.paymentMethod,
    bankTerminalId: row.payoutBankTerminalId ?? undefined,
    population: row.paymentMethod === 'CARD' && !row.reservation.company?.voen?.trim(),
  }));

  return { moneyLines, qtyLines, paymentLines, depositReceiptLines, depositPayoutLines };
}

export async function listNightAuditRuns(limit = 5) {
  return prisma.nightAuditRun.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { businessDay: true },
  });
}

const deskHoldSelect = {
  id: true,
  checkInDate: true,
  checkOutDate: true,
  guest: { select: { fullName: true } },
  room: { select: { roomNumber: true } },
} as const;

/** Open arrivals before this business day, and in-house stays whose checkout is due. */
export async function listNightAuditDeskHolds(businessDate: Date) {
  const { start, end } = bakuDayBounds(hotelDateKey(businessDate));
  const openStatuses: ReservationStatus[] = ['CONFIRMED', 'OPTION'];
  const missedWhere = {
    status: { in: openStatuses },
    checkInDate: { lt: start },
  };
  const dueWhere = {
    status: 'IN_HOUSE' as const,
    checkOutDate: { lt: end },
  };
  const [missedArrivals, dueOuts, missedCount, dueCount] = await Promise.all([
    prisma.reservation.findMany({
      where: missedWhere,
      select: deskHoldSelect,
      orderBy: { checkInDate: 'asc' },
      take: 100,
    }),
    prisma.reservation.findMany({
      where: dueWhere,
      select: deskHoldSelect,
      orderBy: { checkOutDate: 'asc' },
      take: 100,
    }),
    prisma.reservation.count({ where: missedWhere }),
    prisma.reservation.count({ where: dueWhere }),
  ]);
  return { missedArrivals, dueOuts, missedCount, dueCount };
}

export async function runNightAudit() {
  const auditDate = await getCurrentBusinessDate();
  const { assertYearBoundaryAllows } = await import('@/lib/services/year-boundary.service');
  await assertYearBoundaryAllows(auditDate);
  const { getHotelPolicy } = await import('@/lib/services/hotel-policy.service');
  const naPolicy = await getHotelPolicy();
  const holds = await listNightAuditDeskHolds(auditDate);
  if (!naPolicy.autoNoShow && holds.missedCount > 0) {
    throw new Error(
      'Night audit is waiting on the front desk. Resolve missed arrivals first.',
    );
  }
  if (!naPolicy.autoExtendUndeparted && holds.dueCount > 0) {
    throw new Error(
      'Night audit is waiting on the front desk. Resolve due outs first.',
    );
  }
  const businessDateForCash = hotelDateKey(auditDate);
  const unclosedCashRows = await countUnclosedCashDesk(businessDateForCash);
  if (unclosedCashRows > 0) {
    throw new Error('Close front cash rows for this business date before night audit');
  }
  await assertNoOpenPosShifts();
  await assertFinanceQaimeDayClose(businessDateForCash);
  await lockBusinessDateForAudit();
  try {
    return await withNightAuditPosting(() => executeLockedNightAudit());
  } catch (e) {
    await unlockBusinessDateAfterAudit();
    throw e;
  }
}

async function executeLockedNightAudit() {
  const date = await getCurrentBusinessDate();
  let businessDay = await prisma.businessDay.findFirst({ where: { date } });
  if (!businessDay) {
    businessDay = await prisma.businessDay.create({ data: { date, status: 'OPEN' } });
  }
  if (!businessDay) throw new Error('Business day missing');
  if (businessDay.status === 'CLOSED') {
    throw new Error('Business day already closed');
  }

  const run = await prisma.nightAuditRun.create({
    data: { businessDayId: businessDay.id, status: 'RUNNING', stepsJson: '[]' },
  });

  const steps: string[] = [];
  const errors: string[] = [];

  try {
    steps.push('Step 1: Pre-check cash + POS shifts — OK');
    steps.push('Step 1a: e-qaimə day rule — OK');

    const orgId = requestOrganizationId();
    const settlementPolicy = orgId
      ? await resolveSettlementPolicy(orgId)
      : { pendingSettlementNaPolicy: 'BLOCK' as const };
    const pendingCheck = await assertNoOpenPendingForNightAudit(
      settlementPolicy.pendingSettlementNaPolicy,
      date,
    );
    if (pendingCheck.note) {
      steps.push(`Step 1b: Pending settlement reconciliation — ${pendingCheck.note}`);
    } else {
      steps.push('Step 1b: Pending settlement reconciliation — OK');
    }

    const inHouseCount = await prisma.reservation.count({ where: { status: 'IN_HOUSE' } });
    steps.push(`Step 2: In-house reservations: ${inHouseCount}`);

    const { start: dayStart, end: dayEnd } = bakuDayBounds(hotelDateKey(date));

    const unassignedArrivals = await prisma.reservation.findMany({
      where: {
        status: { in: ['CONFIRMED', 'OPTION'] },
        checkInDate: { gte: dayStart, lt: dayEnd },
        roomId: null,
      },
      select: { id: true, guest: { select: { fullName: true } } },
    });
    steps.push(
      `Step 2a: Unassigned arrivals today: ${unassignedArrivals.length}` +
        (unassignedArrivals.length
          ? ` (${unassignedArrivals
              .slice(0, 5)
              .map((r) => r.guest.fullName)
              .join(', ')})`
          : ''),
    );

    const { getHotelPolicy } = await import('@/lib/services/hotel-policy.service');
    const { cancelReservation } = await import('@/lib/services/reservation.service');
    const { addHotelDays, stayCheckOut } = await import('@/lib/hotel-calendar');
    const naPolicy = await getHotelPolicy();
    const holds = await listNightAuditDeskHolds(date);
    if (naPolicy.autoNoShow) {
      for (const row of holds.missedArrivals) {
        await cancelReservation(row.id, true);
      }
      steps.push(`Step 2b: No-show marked — ${holds.missedCount}`);
    }
    if (naPolicy.stopIfGuestFolioBalance) {
      const owing = await listDueGuestFoliosNotZero(date);
      if (owing.length > 0) {
        throw new Error(
          `Departing guest folio is not zero: ${owing
            .map((row) => `${row.label} [${row.reservationId}]`)
            .join('; ')}`,
        );
      }
    }
    if (naPolicy.autoExtendUndeparted) {
      const { alignReservationStaySlices } = await import('@/lib/services/stay-slice.service');
      for (const row of holds.dueOuts) {
        await prisma.reservation.update({
          where: { id: row.id },
          data: { checkOutDate: stayCheckOut(addHotelDays(row.checkOutDate, 1)) },
        });
        await alignReservationStaySlices(row.id);
      }
      steps.push(`Step 2b: Stays extended — ${holds.dueCount}`);
    }
    const holdsAfter = await listNightAuditDeskHolds(date);
    if (holdsAfter.missedCount > 0 || holdsAfter.dueCount > 0) {
      throw new Error(
        'Night audit is waiting on the front desk. Resolve missed arrivals and due outs first.',
      );
    }
    if (!naPolicy.autoNoShow && !naPolicy.autoExtendUndeparted) {
      steps.push('Step 2b: Missed arrivals and due outs — none');
    }
    if (naPolicy.cancelRoomChangePlans) {
      const cancelled = await prisma.roomChangePlan.updateMany({
        where: { status: 'PENDING', effectiveAt: { lt: dayEnd } },
        data: { status: 'CANCELLED' },
      });
      steps.push(`Step 2b: Room-change plans cancelled — ${cancelled.count}`);
    }

    const exceptions = await listCheckedOutOpenBalances();
    steps.push(`Step 2c: Folio exceptions (CHECKED_OUT with open balance): ${exceptions.length}`);
    const { getHotelPolicy: readPolicy } = await import('@/lib/services/hotel-policy.service');
    if ((await readPolicy()).checkCheckedOutFolios && exceptions.length > 0) {
      throw new Error(
        `Checked-out folios still have a balance: ${exceptions
          .map((row) => `${row.label} [${row.reservationId}]`)
          .join('; ')}`,
      );
    }

    const dayCharges = await prisma.folioCharge.findMany({
      where: { businessDate: date },
      select: { amount: true, qty: true },
    });
    const dayPays = await prisma.folioPayment.findMany({
      where: { businessDate: date },
      select: { amount: true, kind: true },
    });
    const paidPending = await prisma.settlementPendingCharge.findMany({
      where: { status: 'PAID', businessDate: date },
      select: { amount: true },
    });
    const pendingMoney = paidPending.reduce((s, row) => s + decimalToNumber(row.amount), 0);
    const trialCharges =
      dayCharges.reduce((s, c) => s + decimalToNumber(c.amount) * c.qty, 0) + pendingMoney;
    const trialPays =
      dayPays.reduce((s, p) => {
        const n = decimalToNumber(p.amount);
        return s + (p.kind === 'REFUND' ? -n : n);
      }, 0) + pendingMoney;
    steps.push(
      `Step 2d: Trial balance — charges ${trialCharges.toFixed(2)} / payments ${trialPays.toFixed(2)} AZN`,
    );
    await prisma.nightAuditRun.update({
      where: { id: run.id },
      data: { stepsJson: JSON.stringify(steps) },
    });

    const revenueRoom = await requireRevenueCodeByRole('ROOM');

    const inHouse = await prisma.reservation.findMany({
      where: { status: 'IN_HOUSE' },
      include: {
        ratePlan: true,
        room: true,
        guest: { select: { fullName: true } },
        folios: { include: { charges: true } },
        dailyRates: true,
      },
    });

    for (const res of inHouse) {
      if (hotelDateKey(res.checkOutDate) <= hotelDateKey(date)) {
        steps.push(`Step 3: Stay ended — reservation ${res.id}; night not posted`);
        continue;
      }
      if (postsStayAsPackage(res.ratePlan)) {
        const { postNightlyPackageCharges } = await import('@/lib/services/san-package.service');
        try {
          const pkgResult = await postNightlyPackageCharges(res.id, date);
          if (pkgResult.posted > 0) {
            steps.push(`Step 3: Package charges posted (${pkgResult.posted} lines) — reservation ${res.id}`);
            continue;
          }
          if (!pkgResult.skipped) {
            steps.push(`Step 3: Package already posted — reservation ${res.id}`);
            continue;
          }
          if (!packageSkipPostsRoom(res.ratePlan)) continue;
        } catch (err) {
          if (err instanceof NightlyPriceMissingError) {
            const who = [
              res.guest?.fullName,
              res.externalRef ? `ref ${res.externalRef}` : null,
              res.room?.roomNumber ? `room ${res.room.roomNumber}` : null,
              `rate ${err.ratePlanCode}`,
            ]
              .filter(Boolean)
              .join(', ');
            if (res.billingMode === 'COMP' || res.billingMode === 'HOUSE') {
              steps.push(`Step 3: Free stay — reservation ${res.id}; night price not required`);
              continue;
            }
            if ((await readPolicy()).stopIfZeroNightPrice) {
              throw new Error(`Night price is zero — ${who} [${res.id}]`);
            }
            steps.push(
              `Step 3: Nightly price missing — reservation ${res.id} (${who}); package charge skipped`,
            );
            continue;
          }
          throw err;
        }
      }

      const alreadyPosted = res.folios.some((f) =>
        f.charges.some(
          (c) =>
            c.revenueCodeId === revenueRoom.id &&
            c.businessDate.toDateString() === date.toDateString(),
        ),
      );
      if (!alreadyPosted) {
        const nightKey = hotelDateKey(date);
        const daily = res.dailyRates.find((d) => hotelDateKey(d.stayDate) === nightKey);
        let amount: number;
        try {
          amount = daily
            ? decimalToNumber(daily.amount)
            : await getNightlyRoomChargeForDate(res.id, date);
        } catch (err) {
          if (err instanceof NightlyPriceMissingError) {
            const who = [
              res.guest?.fullName,
              res.externalRef ? `ref ${res.externalRef}` : null,
              res.room?.roomNumber ? `room ${res.room.roomNumber}` : null,
              `rate ${err.ratePlanCode}`,
            ]
              .filter(Boolean)
              .join(', ');
            if (res.billingMode === 'COMP' || res.billingMode === 'HOUSE') {
              steps.push(`Step 3: Free stay — reservation ${res.id}; night price not required`);
              continue;
            }
            if ((await readPolicy()).stopIfZeroNightPrice) {
              throw new Error(`Night price is zero — ${who} [${res.id}]`);
            }
            steps.push(
              `Step 3: Nightly price missing — reservation ${res.id} (${who}); room charge skipped`,
            );
            continue;
          }
          throw err;
        }

        await postCharge({
          reservationId: res.id,
          revenueCodeId: revenueRoom.id,
          amount,
          qty: 1,
          description: roomChargeNote('night-audit', hotelDateKey(date)),
          businessDate: date,
          audit: { source: 'night_audit' },
        });
        steps.push(`Step 3: Room charge posted (${amount} AZN) — reservation ${res.id}`);
      }
    }
    const businessDateKey = hotelDateKey(date);
    steps.push(`Step 3 complete: room charges for ${businessDateKey}`);
    await prisma.nightAuditRun.update({
      where: { id: run.id },
      data: { stepsJson: JSON.stringify(steps) },
    });

    const document = await collectDayDocument(date);
    const dispatch = await dispatchNightAuditClosed({
      businessDate: businessDateKey,
      nightAuditId: run.id,
      moneyLines: document.moneyLines,
      qtyLines: document.qtyLines,
      paymentLines: document.paymentLines,
      depositReceiptLines: document.depositReceiptLines,
      depositPayoutLines: document.depositPayoutLines,
    });
    if (dispatch.warning) {
      steps.push(`Step 4: Finance warning — ${dispatch.warning}`);
      errors.push(dispatch.warning);
    } else if (!dispatch.dispatched && !dispatch.skipped) {
      const message = dispatch.error ?? 'Day document was not posted';
      steps.push(`Step 4: Finance warning — ${message}`);
      errors.push(message);
    } else {
      steps.push(
        `Step 4: Day document — ${dispatch.skipped ? 'skipped' : 'posted'} (${document.moneyLines.length} money, ${document.qtyLines.length} qty)`,
      );
    }
    const { resolveNightAuditPackSlugs } = await import('@/lib/reports/night-audit-pack');
    const packSlugs = await resolveNightAuditPackSlugs();
    steps.push(`Step 4b: Report pack — ${packSlugs.length} reports`);

    await prisma.businessDay.update({
      where: { id: businessDay.id },
      data: { status: 'CLOSED' },
    });

    if (businessDateKey.endsWith('-12-31')) {
      steps.push('Step 5: Business date stays on 31 Dec until the year is sealed');
    } else {
      const nextDate = await advanceBusinessDate();
      steps.push(`Step 5: Roll business date — next open day ${hotelDateKey(nextDate)}`);
    }
    await prisma.nightAuditRun.update({
      where: { id: run.id },
      data: { stepsJson: JSON.stringify(steps) },
    });

    const completed = await prisma.nightAuditRun.update({
      where: { id: run.id },
      data: {
        status: 'COMPLETED',
        stepsJson: JSON.stringify(steps),
        errorsJson: JSON.stringify(errors),
        completedAt: new Date(),
      },
    });

    return { run: completed, dispatch, steps };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Night audit failed';
    errors.push(message);
    await prisma.nightAuditRun.update({
      where: { id: run.id },
      data: {
        status: 'FAILED',
        errorsJson: JSON.stringify(errors),
        stepsJson: JSON.stringify(steps),
      },
    });
    throw e;
  }
}

export type NightAuditReservationRef = {
  reservationId: string;
  label: string;
  balance?: number;
};

function formatStayLabel(row: {
  room?: { roomNumber: string } | null;
  guest?: { fullName: string } | null;
}): string {
  const room = row.room?.roomNumber ? `#${row.room.roomNumber}` : '';
  const guest = row.guest?.fullName?.trim() || '';
  return [room, guest].filter(Boolean).join(' · ') || 'reservation';
}

/** Due-out IN_HOUSE stays whose GUEST folio balance is not zero. */
async function listDueGuestFoliosNotZero(date: Date): Promise<NightAuditReservationRef[]> {
  const { end } = bakuDayBounds(hotelDateKey(date));
  const stays = await prisma.reservation.findMany({
    where: { status: 'IN_HOUSE', checkOutDate: { lt: end } },
    select: {
      id: true,
      guest: { select: { fullName: true } },
      room: { select: { roomNumber: true } },
    },
  });
  if (stays.length === 0) return [];
  const folios = await prisma.folio.findMany({
    where: { reservationId: { in: stays.map((stay) => stay.id) }, type: 'GUEST' },
    include: { charges: true, payments: true },
  });
  const { folioBalance } = await import('@/lib/services/folio.service');
  const byStay = new Map<string, number>();
  for (const folio of folios) {
    const bal = folioBalance(folio.charges, folio.payments);
    if (Math.abs(bal) <= 0.01) continue;
    byStay.set(folio.reservationId, money2((byStay.get(folio.reservationId) ?? 0) + bal));
  }
  const stayById = new Map(stays.map((stay) => [stay.id, stay]));
  return [...byStay.entries()].map(([reservationId, balance]) => {
    const stay = stayById.get(reservationId);
    const base = stay ? formatStayLabel(stay) : reservationId.slice(0, 8);
    return {
      reservationId,
      balance,
      label: `${base} · ${balance.toFixed(2)} AZN`,
    };
  });
}

/** CHECKED_OUT reservations that still have an OPEN folio with non-zero balance. */
async function listCheckedOutOpenBalances(): Promise<NightAuditReservationRef[]> {
  const folios = await prisma.folio.findMany({
    where: { status: 'OPEN', reservation: { status: 'CHECKED_OUT' } },
    include: {
      charges: true,
      payments: true,
      reservation: {
        select: {
          id: true,
          guest: { select: { fullName: true } },
          room: { select: { roomNumber: true } },
        },
      },
    },
  });
  const { folioBalance } = await import('@/lib/services/folio.service');
  const byStay = new Map<string, { balance: number; label: string }>();
  for (const folio of folios) {
    const bal = folioBalance(folio.charges, folio.payments);
    if (Math.abs(bal) <= 0.01) continue;
    const prev = byStay.get(folio.reservation.id);
    const nextBal = money2((prev?.balance ?? 0) + bal);
    byStay.set(folio.reservation.id, {
      balance: nextBal,
      label: `${formatStayLabel(folio.reservation)} · ${nextBal.toFixed(2)} AZN`,
    });
  }
  return [...byStay.entries()].map(([reservationId, row]) => ({
    reservationId,
    balance: row.balance,
    label: row.label,
  }));
}

async function medicalNightAmount(reservationId: string, date: Date): Promise<number | null> {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: {
      roomTypeId: true,
      mealPlanId: true,
      medicalPackageCode: true,
      ratePlan: { select: { code: true } },
    },
  });
  if (!reservation) return null;
  const { resolveStaySliceForDate } = await import('@/lib/services/stay-slice.service');
  const slice = await resolveStaySliceForDate(reservationId, date);
  const roomTypeId = slice?.roomTypeId ?? reservation.roomTypeId;
  if (!roomTypeId) return null;
  const pax = await prisma.reservationGuest.findMany({
    where: { reservationId },
    select: { medicalPackageCode: true, firstName: true, lastName: true, guestId: true },
    orderBy: { sortOrder: 'asc' },
  });
  const { paxCodesForCompose } = await import('@/lib/services/nafta-package-compose.service');
  const stayCode = reservation.ratePlan.code ?? reservation.medicalPackageCode;
  const packageCodes =
    pax.length > 0
      ? paxCodesForCompose(pax, stayCode)
      : [reservation.medicalPackageCode].filter((code): code is string => Boolean(code));
  const { ownerPackageNightlyBreakdown } = await import(
    '@/lib/services/nafta-package-compose-apply.service'
  );
  const breakdown = await ownerPackageNightlyBreakdown(date, packageCodes, {
    roomTypeId,
    mealPlanId: reservation.mealPlanId,
  });
  return breakdown?.total ?? null;
}

/** Stays that would skip or stop the night because the price is missing or zero. Does not post. */
async function listZeroNightPrices(date: Date): Promise<NightAuditReservationRef[]> {
  const inHouse = await prisma.reservation.findMany({
    where: { status: 'IN_HOUSE' },
    include: {
      ratePlan: { select: { medicalFlag: true } },
      dailyRates: true,
      guest: { select: { fullName: true } },
      room: { select: { roomNumber: true } },
    },
  });
  const nightKey = hotelDateKey(date);
  const missing: NightAuditReservationRef[] = [];
  for (const stay of inHouse) {
    if (hotelDateKey(stay.checkOutDate) <= nightKey) continue;
    if (stay.billingMode === 'COMP' || stay.billingMode === 'HOUSE') continue;
    let bad = false;
    const daily = stay.dailyRates.find((row) => hotelDateKey(row.stayDate) === nightKey);
    if (daily) {
      bad = !(decimalToNumber(daily.amount) > 0);
    } else if (stay.ratePlan.medicalFlag) {
      const quoted = await medicalNightAmount(stay.id, date);
      bad = !(quoted != null && quoted > 0);
    } else {
      try {
        const amount = await getNightlyRoomChargeForDate(stay.id, date);
        bad = !(amount > 0);
      } catch (err) {
        if (err instanceof NightlyPriceMissingError) bad = true;
        else throw err;
      }
    }
    if (bad) {
      missing.push({
        reservationId: stay.id,
        label: formatStayLabel(stay),
      });
    }
  }
  return missing;
}

export type NightAuditStepView = {
  id: string;
  state: 'wait' | 'done' | 'stop';
  detail: string;
  /** Reservations that block this step — UI opens the stay card. */
  refs?: NightAuditReservationRef[];
};

function stepRefs(
  state: 'wait' | 'done' | 'stop',
  refs: NightAuditReservationRef[],
): Pick<NightAuditStepView, 'refs'> {
  return state === 'stop' && refs.length > 0 ? { refs } : {};
}

/** Read-only checklist. Does not post charges or roll the date. */
export async function previewNightAudit(): Promise<{
  date: string;
  steps: NightAuditStepView[];
  canClose: boolean;
}> {
  const date = await getCurrentBusinessDate();
  const key = hotelDateKey(date);
  const { getHotelPolicy } = await import('@/lib/services/hotel-policy.service');
  const policy = await getHotelPolicy();
  const holds = await listNightAuditDeskHolds(date);
  const unclosed = await countUnclosedCashDesk(key);
  const pos = await getPosShiftStatus();
  const pending = await getPendingSummary(date);
  const organizationId = requestOrganizationId();
  const settlement = organizationId
    ? await resolveSettlementPolicy(organizationId)
    : { pendingSettlementNaPolicy: 'BLOCK' as const };
  const pendingStops = pending.pendingCount > 0 && settlement.pendingSettlementNaPolicy === 'BLOCK';
  const { yearBoundaryFlags } = await import('@/lib/services/year-boundary.service');
  const year = await yearBoundaryFlags(key);
  const yearStops = key.endsWith('-01-01') && !year.yearOpened;
  const zeroPriceRefs = policy.stopIfZeroNightPrice ? await listZeroNightPrices(date) : [];
  const owingGuests = policy.stopIfGuestFolioBalance ? await listDueGuestFoliosNotZero(date) : [];
  const checkedOut = policy.checkCheckedOutFolios ? await listCheckedOutOpenBalances() : [];
  const folioRefs = [...owingGuests, ...checkedOut];
  const arrivalRefs: NightAuditReservationRef[] = holds.missedArrivals.map((row) => ({
    reservationId: row.id,
    label: formatStayLabel(row),
  }));
  const dueRefs: NightAuditReservationRef[] = holds.dueOuts.map((row) => ({
    reservationId: row.id,
    label: formatStayLabel(row),
  }));
  let qaimeStops = false;
  let qaimeDetail = '';
  try {
    const qaime = await fetchQaimeDayClose(key);
    if (qaime.enabled && qaime.gaps.length > 0) {
      qaimeStops = true;
      qaimeDetail = String(qaime.gaps.length);
    }
  } catch (err) {
    if (err instanceof QaimeDayCloseUnreachableError) {
      qaimeStops = true;
      qaimeDetail = 'down';
    } else {
      throw err;
    }
  }
  const arrivalsState: NightAuditStepView['state'] =
    !policy.autoNoShow && holds.missedCount > 0 ? 'stop' : 'done';
  const dueState: NightAuditStepView['state'] =
    !policy.autoExtendUndeparted && holds.dueCount > 0 ? 'stop' : 'done';
  const priceState: NightAuditStepView['state'] = zeroPriceRefs.length > 0 ? 'stop' : 'done';
  const foliosState: NightAuditStepView['state'] = folioRefs.length > 0 ? 'stop' : 'done';
  const steps: NightAuditStepView[] = [
    { id: 'cash', state: unclosed > 0 ? 'stop' : 'done', detail: String(unclosed) },
    { id: 'pos', state: pos.hasOpenShift ? 'stop' : 'done', detail: pos.hasOpenShift ? 'open' : '' },
    { id: 'pending', state: pendingStops ? 'stop' : 'done', detail: String(pending.pendingCount) },
    {
      id: 'arrivals',
      state: arrivalsState,
      detail: String(holds.missedCount),
      ...stepRefs(arrivalsState, arrivalRefs),
    },
    {
      id: 'due',
      state: dueState,
      detail: String(holds.dueCount),
      ...stepRefs(dueState, dueRefs),
    },
    {
      id: 'price',
      state: priceState,
      detail: String(zeroPriceRefs.length),
      ...stepRefs(priceState, zeroPriceRefs),
    },
    {
      id: 'folios',
      state: foliosState,
      detail: String(folioRefs.length),
      ...stepRefs(foliosState, folioRefs),
    },
    { id: 'qaime', state: qaimeStops ? 'stop' : 'done', detail: qaimeDetail },
    { id: 'moves', state: 'done', detail: '' },
    { id: 'night', state: yearStops ? 'stop' : 'wait', detail: yearStops ? 'YEAR_NOT_OPEN' : '' },
    { id: 'finance', state: 'wait', detail: '' },
    { id: 'pack', state: 'wait', detail: '' },
    { id: 'roll', state: 'wait', detail: key.endsWith('-12-31') ? 'year' : '' },
  ];
  return { date: key, steps, canClose: steps.every((step) => step.state !== 'stop') };
}
