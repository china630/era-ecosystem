import { bakuDayBounds } from '@era/satellite-kit/time';
import { hotelDateKey } from '@/lib/hotel-calendar';
import { prisma } from '@/lib/prisma';
import { requestOrganizationId } from '@/lib/request-organization';
import { decimalToNumber, toDecimal } from '@/lib/decimal';
import { postCharge } from '@/lib/services/folio.service';
import { findRevenueCodeByToken } from '@/lib/revenue-code-token';
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
  const noShowCandidates = await prisma.reservation.count({
    where: {
      status: { in: ['CONFIRMED', 'OPTION'] },
      checkInDate: { lt: dayStart },
      roomId: null,
    },
  });

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
      noShowCandidates,
    },
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

  const saleBySku = new Map<string, { sku: string; qty: number; amount: number }>();
  const revenueByCode = new Map<string, number>();
  const addSale = (sku: string | null | undefined, qty: number, amount: number) => {
    const trimmed = sku?.trim();
    if (!trimmed) return false;
    const key = trimmed.toLowerCase();
    const row = saleBySku.get(key) ?? { sku: trimmed, qty: 0, amount: 0 };
    row.qty += qty;
    row.amount = money2(row.amount + amount);
    saleBySku.set(key, row);
    return true;
  };

  for (const charge of charges) {
    const amount = money2(decimalToNumber(charge.amount) * charge.qty);
    if (!addSale(charge.sku, charge.qty, amount)) {
      const code = charge.revenueCode.code;
      revenueByCode.set(code, (revenueByCode.get(code) ?? 0) + amount);
    }
  }
  for (const row of pending) {
    const amount = money2(decimalToNumber(row.amount));
    if (!addSale(row.sku, row.qty, amount)) {
      const code = row.revenueCode?.trim() || 'UNKNOWN';
      revenueByCode.set(code, (revenueByCode.get(code) ?? 0) + amount);
    }
  }
  const consumption = await prisma.hkConsumption.findMany({ where: { businessDate: date } });
  for (const row of consumption) {
    addSale(row.sku, decimalToNumber(row.qty), 0);
  }

  const saleLines = [...saleBySku.values()].filter((line) => line.qty !== 0 || line.amount !== 0);
  const revenueLines = [...revenueByCode.entries()]
    .filter(([, amount]) => amount !== 0)
    .map(([revenueCode, amount]) => ({ revenueCode, amount: money2(amount) }));

  const payByMethod = new Map<string, number>();
  const addPay = (method: string, signed: number) => {
    const key = method.trim() || 'CASH';
    payByMethod.set(key, money2((payByMethod.get(key) ?? 0) + signed));
  };
  for (const payment of payments) {
    const amount = decimalToNumber(payment.amount);
    addPay(payment.paymentMethod, payment.kind === 'REFUND' ? -amount : amount);
  }
  for (const row of pending) {
    addPay(row.paymentMethod?.trim() || 'CASH', decimalToNumber(row.amount));
  }
  const paymentLines = [...payByMethod.entries()]
    .filter(([, amount]) => amount !== 0)
    .map(([method, amount]) => ({ method, amount }));

  return { saleLines, revenueLines, paymentLines };
}

export async function listNightAuditRuns(limit = 5) {
  return prisma.nightAuditRun.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { businessDay: true },
  });
}

export async function runNightAudit() {
  const businessDateForCash = hotelDateKey(await getCurrentBusinessDate());
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

    const noShowCandidates = await prisma.reservation.findMany({
      where: {
        status: { in: ['CONFIRMED', 'OPTION'] },
        checkInDate: { lt: dayStart },
        roomId: null,
      },
      take: 50,
    });
    let noShowCount = 0;
    for (const r of noShowCandidates) {
      await prisma.reservation.update({
        where: { id: r.id },
        data: { status: 'NO_SHOW' },
      });
      noShowCount += 1;
    }
    steps.push(`Step 2b: Auto no-show marked: ${noShowCount}`);

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

    const revenueRoom = await findRevenueCodeByToken('ROOM');
    if (!revenueRoom) throw new Error('Revenue code ROOM not configured');

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
        const daily = res.dailyRates.find(
          (d) => d.stayDate.toISOString().slice(0, 10) === date.toISOString().slice(0, 10),
        );
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
          description: `Night audit room charge ${date.toISOString().slice(0, 10)}`,
          businessDate: date,
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
