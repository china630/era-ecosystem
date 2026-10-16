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
import { resolveSettlementPolicy } from '@era/satellite-kit';

export async function getNightAuditStatus() {
  await ensureCurrentBusinessDayOpen();
  const openShift = await prisma.cashShift.findFirst({ where: { status: 'OPEN' } });
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
  };
}

function money2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Folio money follows folioBalance (amount × qty). Pending amount is the cashier line total. */
async function collectDayDocument(date: Date) {
  const charges = await prisma.folioCharge.findMany({
    where: { businessDate: date },
    include: { revenueCode: true },
  });
  const pending = await prisma.settlementPendingCharge.findMany({
    where: { status: 'PAID', businessDate: date },
  });
  const payments = await prisma.folioPayment.findMany({
    where: { businessDate: date },
  });

  const saleByKey = new Map<
    string,
    { sku: string; qty: number; amount: number; revenueCode: string }
  >();
  const revenueByCode = new Map<string, number>();
  const addSale = (
    sku: string | null | undefined,
    qty: number,
    amount: number,
    revenueCode: string,
  ) => {
    const trimmed = sku?.trim();
    if (!trimmed) return false;
    const code = revenueCode.trim();
    const key = `${trimmed.toLowerCase()}|${code}`;
    const row = saleByKey.get(key) ?? { sku: trimmed, qty: 0, amount: 0, revenueCode: code };
    row.qty += qty;
    row.amount = money2(row.amount + amount);
    saleByKey.set(key, row);
    return true;
  };

  for (const charge of charges) {
    const amount = money2(decimalToNumber(charge.amount) * charge.qty);
    const code = charge.revenueCode.code;
    if (!addSale(charge.sku, charge.qty, amount, code)) {
      revenueByCode.set(code, (revenueByCode.get(code) ?? 0) + amount);
    }
  }
  for (const row of pending) {
    const amount = money2(decimalToNumber(row.amount));
    const code = row.revenueCode?.trim() || 'UNKNOWN';
    if (!addSale(row.sku, row.qty, amount, code)) {
      revenueByCode.set(code, (revenueByCode.get(code) ?? 0) + amount);
    }
  }
  const consumption = await prisma.hkConsumption.findMany({ where: { businessDate: date } });
  for (const row of consumption) {
    addSale(row.sku, decimalToNumber(row.qty), 0, '');
  }

  const saleLines = [...saleByKey.values()].filter((line) => line.qty !== 0 || line.amount !== 0);
  const revenueLines = [...revenueByCode.entries()]
    .filter(([, amount]) => amount !== 0)
    .map(([revenueCode, amount]) => ({ revenueCode, amount: money2(amount) }));

  const payByMethod = new Map<string, { method: string; amount: number; bankTerminalId?: string }>();
  const addPay = (method: string, signed: number, bankTerminalId?: string | null) => {
    const name = method.trim() || 'CASH';
    const bank = name === 'CARD' ? bankTerminalId?.trim() || undefined : undefined;
    const key = bank ? `${name}|${bank}` : name;
    const row = payByMethod.get(key) ?? { method: name, amount: 0, bankTerminalId: bank };
    row.amount = money2(row.amount + signed);
    payByMethod.set(key, row);
  };
  for (const payment of payments) {
    const amount = decimalToNumber(payment.amount);
    addPay(
      payment.paymentMethod,
      payment.kind === 'REFUND' ? -amount : amount,
      payment.bankTerminalId,
    );
  }
  for (const row of pending) {
    addPay(row.paymentMethod?.trim() || 'CASH', decimalToNumber(row.amount));
  }
  const paymentLines = [...payByMethod.values()].filter((row) => row.amount !== 0);

  const day = bakuDayBounds(hotelDateKey(date));
  const inDay = { gte: day.start, lt: day.end };
  const carried = await prisma.folioDeposit.findMany({
    where: { status: 'CARRIED', appliedAt: inDay },
  });
  const depositCarryLines = carried.map((row) => ({
    amount: money2(decimalToNumber(row.amount)),
    kind: 'LIABILITY_TRANSFER' as const,
  }));
  const payouts = await prisma.folioDeposit.findMany({
    where: { status: 'REFUNDED', refundedAt: inDay },
  });
  const depositPayoutLines = payouts.map((row) => ({
    amount: money2(decimalToNumber(row.amount)),
    method: row.paymentMethod,
    bankTerminalId: row.payoutBankTerminalId ?? undefined,
  }));

  return { saleLines, revenueLines, paymentLines, depositCarryLines, depositPayoutLines };
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
  const holds = await listNightAuditDeskHolds(auditDate);
  if (holds.missedCount > 0 || holds.dueCount > 0) {
    throw new Error(
      'Night audit is waiting on the front desk. Resolve missed arrivals and due outs first.',
    );
  }
  const businessDateForCash = hotelDateKey(auditDate);
  const unclosedCashRows = await countUnclosedCashDesk(businessDateForCash);
  if (unclosedCashRows > 0) {
    throw new Error('Close front cash rows for this business date before night audit');
  }
  await assertNoOpenPosShifts();
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

    const holds = await listNightAuditDeskHolds(date);
    if (holds.missedCount > 0 || holds.dueCount > 0) {
      throw new Error(
        'Night audit is waiting on the front desk. Resolve missed arrivals and due outs first.',
      );
    }
    steps.push('Step 2b: Missed arrivals and due outs — none');

    const openFoliosWithBalance = await prisma.folio.findMany({
      where: { status: 'OPEN' },
      include: { charges: true, payments: true, reservation: { select: { id: true, status: true } } },
    });
    const { folioBalance: fb } = await import('@/lib/services/folio.service');
    const exceptions = openFoliosWithBalance.filter((f) => {
      const bal = fb(f.charges, f.payments);
      return Math.abs(bal) > 0.01 && f.reservation.status === 'CHECKED_OUT';
    });
    steps.push(`Step 2c: Folio exceptions (CHECKED_OUT with open balance): ${exceptions.length}`);

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
      if (res.ratePlan.medicalFlag) {
        const { postNightlyPackageCharges } = await import('@/lib/services/san-package.service');
        try {
          const pkgResult = await postNightlyPackageCharges(res.id, date);
          if (pkgResult.posted > 0) {
            steps.push(`Step 3: Package charges posted (${pkgResult.posted} lines) — reservation ${res.id}`);
          } else if (!pkgResult.skipped) {
            steps.push(`Step 3: Package already posted — reservation ${res.id}`);
          }
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
            steps.push(
              `Step 3: Nightly price missing — reservation ${res.id} (${who}); package charge skipped`,
            );
            continue;
          }
          throw err;
        }
        continue;
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

    const document = await collectDayDocument(date);
    const dispatch = await dispatchNightAuditClosed({
      businessDate: businessDateKey,
      nightAuditId: run.id,
      saleLines: document.saleLines,
      revenueLines: document.revenueLines,
      paymentLines: document.paymentLines,
      depositCarryLines: document.depositCarryLines,
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
        `Step 4: Day document — ${dispatch.skipped ? 'skipped' : 'posted'} (${document.saleLines.length} sale lines)`,
      );
    }

    await prisma.businessDay.update({
      where: { id: businessDay.id },
      data: { status: 'CLOSED' },
    });

    const nextDate = await advanceBusinessDate();
    steps.push(`Step 5: Roll business date — next open day ${hotelDateKey(nextDate)}`);

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
