import { prisma } from '@/lib/prisma';
import { decimalToNumber, toDecimal } from '@/lib/decimal';
import { postCharge } from '@/lib/services/folio.service';
import { dispatchNightAuditClosed } from '@/lib/integration/event-dispatcher';
import { assertNoOpenPosShifts, getPosShiftStatus } from '@/lib/services/pms-bridge.service';
import {
  getCurrentBusinessDate,
  advanceBusinessDate,
  lockBusinessDateForAudit,
} from '@/lib/services/business-date.service';
import { getNightlyRoomChargeForDate } from '@/lib/services/pricing-quote.service';

export async function getNightAuditStatus() {
  const openShift = await prisma.cashShift.findFirst({ where: { status: 'OPEN' } });
  const posShiftStatus = await getPosShiftStatus();
  const currentBiz = await getCurrentBusinessDate();
  const businessDay = await prisma.businessDay.findUnique({
    where: { date: currentBiz },
    include: { nightRuns: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });
  const inHouseCount = await prisma.reservation.count({ where: { status: 'IN_HOUSE' } });
  const { getBusinessDateStatus } = await import('@/lib/services/business-date.service');
  const bizStatus = await getBusinessDateStatus();
  return {
    openShift,
    posShiftStatus,
    businessDay,
    lastRun: businessDay?.nightRuns[0] ?? null,
    inHouseCount,
    businessDate: bizStatus,
  };
}

export async function listNightAuditRuns(limit = 5) {
  return prisma.nightAuditRun.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { businessDay: true },
  });
}

export async function runNightAudit() {
  const openShift = await prisma.cashShift.findFirst({ where: { status: 'OPEN' } });
  if (openShift) throw new Error('Close all cash shifts before night audit');
  await assertNoOpenPosShifts();
  await lockBusinessDateForAudit();

  const date = await getCurrentBusinessDate();
  let businessDay = await prisma.businessDay.findUnique({ where: { date } });
  if (!businessDay) {
    businessDay = await prisma.businessDay.create({ data: { date, status: 'OPEN' } });
  }
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
    const inHouseCount = await prisma.reservation.count({ where: { status: 'IN_HOUSE' } });
    steps.push(`Step 2: In-house reservations: ${inHouseCount}`);

    const revenueRoom = await prisma.revenueCode.findUnique({ where: { code: 'ROOM' } });
    if (!revenueRoom) throw new Error('Revenue code ROOM not configured');

    const inHouse = await prisma.reservation.findMany({
      where: { status: 'IN_HOUSE' },
      include: { ratePlan: true, room: true, folios: { include: { charges: true } }, dailyRates: true },
    });

    for (const res of inHouse) {
      if (res.ratePlan.medicalFlag) {
        const { postNightlyPackageCharges } = await import('@/lib/services/san-package.service');
        const pkgResult = await postNightlyPackageCharges(res.id, date);
        if (pkgResult.posted > 0) {
          steps.push(`Step 3: Package charges posted (${pkgResult.posted} lines) — reservation ${res.id}`);
        } else if (!pkgResult.skipped) {
          steps.push(`Step 3: Package already posted — reservation ${res.id}`);
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
        const amount = daily
          ? decimalToNumber(daily.amount)
          : await getNightlyRoomChargeForDate(res.id, date);

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
    steps.push(`Step 3 complete: room charges for ${date.toISOString().slice(0, 10)}`);

    await prisma.businessDay.update({
      where: { id: businessDay.id },
      data: { status: 'CLOSED' },
    });

    const nextDate = await advanceBusinessDate();
    steps.push(`Step 4: Roll business date — next open day ${nextDate.toISOString().slice(0, 10)}`);

    const aggregates = await prisma.folioCharge.groupBy({
      by: ['revenueCodeId'],
      where: { businessDate: date },
      _sum: { amount: true },
    });

    const codes = await prisma.revenueCode.findMany({
      where: { id: { in: aggregates.map((a) => a.revenueCodeId) } },
    });

    const revenueLines = aggregates.map((a) => {
      const code = codes.find((c) => c.id === a.revenueCodeId);
      return {
        revenueCode: code?.code ?? 'UNKNOWN',
        amount: decimalToNumber(a._sum.amount ?? 0),
      };
    });

    const payments = await prisma.folioPayment.findMany({
      where: { createdAt: { gte: date, lt: new Date(date.getTime() + 86400000) } },
    });
    const paymentByMethod = new Map<string, number>();
    for (const p of payments) {
      const key = p.paymentMethod;
      paymentByMethod.set(key, (paymentByMethod.get(key) ?? 0) + decimalToNumber(p.amount));
    }
    const paymentLines = [...paymentByMethod.entries()].map(([method, amount]) => ({
      method,
      amount,
    }));

    const dispatch = await dispatchNightAuditClosed({
      businessDate: date.toISOString().slice(0, 10),
      nightAuditId: run.id,
      revenueLines,
      paymentLines,
    });

    steps.push(`Step 5: E1 dispatch — ${dispatch.dispatched ? 'sent' : dispatch.skipped ? 'skipped' : 'failed'}`);

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
    const profile = await prisma.hotelProfile.findFirst({ orderBy: { createdAt: 'asc' } });
    if (profile) {
      await prisma.hotelProfile.update({
        where: { id: profile.id },
        data: { businessDateLocked: false },
      });
    }
    throw e;
  }
}
