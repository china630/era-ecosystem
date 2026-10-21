import { bakuCivilUtcDate } from '@era/satellite-kit/time';
import { hotelDateKey } from '@/lib/hotel-calendar';
import { prisma } from '@/lib/prisma';
import { requestOrganizationId } from '@/lib/request-organization';
import { advanceBusinessDate, getBusinessDateStatus } from '@/lib/services/business-date.service';
import { countUnclosedCashDesk } from '@/lib/services/cash-desk.service';
import { getHotelPolicy } from '@/lib/services/hotel-policy.service';
import { getPosShiftStatus } from '@/lib/services/pms-bridge.service';
import { getPendingSummary } from '@/lib/services/settlement-hub.service';
import { resolveSettlementPolicy } from '@era/satellite-kit';

export type YearBlock = { code: string; detail: string };

function orgId() {
  return requestOrganizationId();
}

/** Refuse a posting into a sealed year, or into 1 Jan before the year is opened. */
export async function assertYearBoundaryAllows(businessDate: Date): Promise<void> {
  const key = hotelDateKey(businessDate);
  const year = Number(key.slice(0, 4));
  const organizationId = orgId();
  if (!organizationId) return;
  if (key.endsWith('-01-01')) {
    const opened = await prisma.hotelYearBoundary.findFirst({
      where: { organizationId, year, kind: 'OPENED' },
    });
    if (!opened) throw new Error('YEAR_NOT_OPEN');
    return;
  }
  const closed = await prisma.hotelYearBoundary.findFirst({
    where: { organizationId, year, kind: 'CLOSED' },
  });
  if (closed) throw new Error('YEAR_CLOSED');
}

export async function lastDayBlocks(businessDate: string): Promise<YearBlock[]> {
  const blocks: YearBlock[] = [];
  const organizationId = orgId();
  const unclosed = await countUnclosedCashDesk(businessDate);
  if (unclosed > 0) blocks.push({ code: 'CASH_OPEN', detail: String(unclosed) });
  const pos = await getPosShiftStatus();
  if (pos.hasOpenShift) blocks.push({ code: 'POS_OPEN', detail: pos.outlets.map((row) => row.outletCode).join(', ') });
  const policy = organizationId
    ? await resolveSettlementPolicy(organizationId)
    : { pendingSettlementNaPolicy: 'BLOCK' as const };
  const pending = await getPendingSummary(bakuCivilUtcDate(businessDate));
  if (pending.pendingCount > 0 && policy.pendingSettlementNaPolicy === 'BLOCK') {
    blocks.push({ code: 'PENDING', detail: String(pending.pendingCount) });
  }
  const hotelPolicy = await getHotelPolicy();
  if (hotelPolicy.yearEndBlockIfOpenCityLedger) {
    const ledger = await openCityLedgerCount();
    if (ledger.count > 0) {
      blocks.push({ code: 'CITY_LEDGER', detail: `${ledger.count}:${ledger.totalAzn.toFixed(2)}` });
    }
  }
  const checkedOut = await checkedOutOpenBalanceCount();
  if (checkedOut > 0) blocks.push({ code: 'CHECKED_OUT_BALANCE', detail: String(checkedOut) });
  const year = Number(businessDate.slice(0, 4));
  const openDays = await prisma.businessDay.count({
    where: {
      organizationId,
      status: 'OPEN',
      date: { gte: bakuCivilUtcDate(`${year}-01-01`), lt: bakuCivilUtcDate(businessDate) },
    },
  });
  if (openDays > 0) blocks.push({ code: 'OPEN_DAYS', detail: String(openDays) });
  return blocks;
}

async function balanceOf(charges: { amount: { toString(): string }; qty?: number }[], payments: { amount: { toString(): string }; kind?: string }[]) {
  const { folioBalance } = await import('@/lib/services/folio.service');
  return folioBalance(charges as never, payments as never);
}

async function openCityLedgerCount() {
  const folios = await prisma.folio.findMany({
    where: { status: 'TRANSFERRED_AR', type: { in: ['AGENCY', 'COMPANY'] } },
    include: { charges: true, payments: true },
    take: 200,
  });
  let count = 0;
  let totalAzn = 0;
  for (const folio of folios) {
    const balance = await balanceOf(folio.charges, folio.payments);
    if (balance > 0.01) {
      count += 1;
      totalAzn += balance;
    }
  }
  return { count, totalAzn };
}

async function checkedOutOpenBalanceCount() {
  const folios = await prisma.folio.findMany({
    where: { status: 'OPEN', reservation: { status: 'CHECKED_OUT' } },
    include: { charges: true, payments: true },
    take: 200,
  });
  let count = 0;
  for (const folio of folios) {
    if (Math.abs(await balanceOf(folio.charges, folio.payments)) > 0.01) count += 1;
  }
  return count;
}

export async function sealLastDayOfYear(actorUserId?: string | null) {
  const status = await getBusinessDateStatus();
  const key = status.currentBusinessDate;
  if (!key.endsWith('-12-31')) throw new Error('YEAR_LAST_DAY_ONLY');
  if (status.businessDayStatus !== 'CLOSED') throw new Error('YEAR_DAY_NOT_CLOSED');
  const year = Number(key.slice(0, 4));
  const organizationId = orgId();
  const existing = await prisma.hotelYearBoundary.findFirst({
    where: { organizationId, year, kind: 'CLOSED' },
  });
  if (existing) throw new Error('YEAR_ALREADY_CLOSED');
  const blocks = await lastDayBlocks(key);
  if (blocks.length > 0) {
    const error = new Error(blocks[0]!.code);
    (error as Error & { blocks: YearBlock[] }).blocks = blocks;
    throw error;
  }
  await prisma.hotelYearBoundary.create({
    data: {
      organizationId,
      year,
      kind: 'CLOSED',
      businessDate: bakuCivilUtcDate(key),
      actorUserId: actorUserId ?? null,
    },
  });
  const next = await advanceBusinessDate();
  return { year, nextBusinessDate: hotelDateKey(next) };
}

export async function openFirstDayOfYear(actorUserId?: string | null) {
  const status = await getBusinessDateStatus();
  const key = status.currentBusinessDate;
  if (!key.endsWith('-01-01')) throw new Error('YEAR_FIRST_DAY_ONLY');
  const year = Number(key.slice(0, 4));
  const organizationId = orgId();
  const existing = await prisma.hotelYearBoundary.findFirst({
    where: { organizationId, year, kind: 'OPENED' },
  });
  if (existing) throw new Error('YEAR_ALREADY_OPEN');
  const previousYear = year - 1;
  const previousClosed = await prisma.hotelYearBoundary.findFirst({
    where: { organizationId, year: previousYear, kind: 'CLOSED' },
  });
  const previousDays = await prisma.businessDay.count({
    where: {
      organizationId,
      date: {
        gte: bakuCivilUtcDate(`${previousYear}-01-01`),
        lt: bakuCivilUtcDate(`${year}-01-01`),
      },
    },
  });
  if (previousDays > 0 && !previousClosed) throw new Error('YEAR_PREVIOUS_OPEN');
  await prisma.hotelYearBoundary.create({
    data: {
      organizationId,
      year,
      kind: 'OPENED',
      businessDate: bakuCivilUtcDate(key),
      actorUserId: actorUserId ?? null,
    },
  });
  return { year, businessDate: key };
}

export async function yearBoundaryFlags(businessDate: string) {
  const organizationId = orgId();
  const year = Number(businessDate.slice(0, 4));
  const [closed, opened] = await Promise.all([
    prisma.hotelYearBoundary.findFirst({ where: { organizationId, year, kind: 'CLOSED' } }),
    prisma.hotelYearBoundary.findFirst({ where: { organizationId, year, kind: 'OPENED' } }),
  ]);
  return {
    isLastDayOfYear: businessDate.endsWith('-12-31'),
    isFirstDayOfYear: businessDate.endsWith('-01-01'),
    yearClosed: Boolean(closed),
    yearOpened: Boolean(opened),
  };
}
