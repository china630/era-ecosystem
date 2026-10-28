import { randomUUID } from 'crypto';
import { bakuCivilUtcDate, todayBakuYmd } from '@era/satellite-kit/time';
import { prisma } from '@/lib/prisma';
import { decimalToNumber, toDecimal } from '@/lib/decimal';
import { hotelDateKey } from '@/lib/hotel-calendar';
import { requestOrganizationId } from '@/lib/request-organization';
import { isRoomAndTaxRevenueCode } from '@/lib/services/booking-folio.service';
import {
  buildComputedLines,
  forecastCommissionAmount,
  type CommissionSliceInput,
  type RoomChargeSlice,
} from '@/lib/services/agency-commission.math';
import type {
  AgencyCommissionBatchStatus,
  AgencyCommissionLineStatus,
  CommissionBasis,
} from '@prisma/client';

const TERMINAL_LINE: AgencyCommissionLineStatus[] = ['PAID', 'VOID', 'IN_PAYMENT'];

function resolvePercent(
  contractPct: number | null | undefined,
  agencyPct: number | null | undefined,
): number {
  if (contractPct != null && Number.isFinite(contractPct)) return Number(contractPct);
  if (agencyPct != null && Number.isFinite(agencyPct)) return Number(agencyPct);
  return 0;
}

async function loadStayForAccrual(reservationId: string) {
  return prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      agency: true,
      salesContract: { select: { commissionPercent: true, commissionBasis: true } },
      commercialPeriods: { orderBy: { fromDate: 'asc' } },
      folios: {
        include: {
          charges: { include: { revenueCode: { include: { ratePlansRoom: { select: { id: true }, take: 1 } } } } },
        },
      },
      dailyRates: true,
      guest: { select: { fullName: true } },
      room: { select: { roomNumber: true } },
    },
  });
}

function slicesFromStay(stay: NonNullable<Awaited<ReturnType<typeof loadStayForAccrual>>>): CommissionSliceInput[] {
  const stayFrom = stay.checkInDate;
  const stayTo = stay.checkOutDate;
  const periods = stay.commercialPeriods ?? [];

  if (periods.length === 0) {
    const agencyId = stay.agencyId;
    if (!agencyId) return [];
    const pct = resolvePercent(
      stay.salesContract?.commissionPercent != null
        ? decimalToNumber(stay.salesContract.commissionPercent)
        : null,
      stay.agency?.commissionPercent != null ? decimalToNumber(stay.agency.commissionPercent) : null,
    );
    return [
      {
        periodKey: 'default',
        commercialPeriodId: null,
        agencyId,
        fromDate: stayFrom,
        toDate: stayTo,
        commissionBasis: stay.commissionBasis,
        commissionPercent: pct,
      },
    ];
  }

  const out: CommissionSliceInput[] = [];
  for (let i = 0; i < periods.length; i++) {
    const p = periods[i]!;
    const agencyId = p.agencyId ?? stay.agencyId;
    if (!agencyId) continue;
    const next = periods[i + 1];
    const toDate = p.toDate ?? next?.fromDate ?? stayTo;
    const pct = resolvePercent(
      p.commissionPercent != null
        ? decimalToNumber(p.commissionPercent)
        : stay.salesContract?.commissionPercent != null
          ? decimalToNumber(stay.salesContract.commissionPercent)
          : null,
      stay.agency?.commissionPercent != null ? decimalToNumber(stay.agency.commissionPercent) : null,
    );
    out.push({
      periodKey: p.id,
      commercialPeriodId: p.id,
      agencyId,
      fromDate: p.fromDate,
      toDate,
      commissionBasis: p.commissionBasis,
      commissionPercent: pct,
    });
  }
  return out;
}

function roomChargesFromStay(
  stay: NonNullable<Awaited<ReturnType<typeof loadStayForAccrual>>>,
): RoomChargeSlice[] {
  const charges: RoomChargeSlice[] = [];
  for (const folio of stay.folios) {
    for (const c of folio.charges) {
      const rc = c.revenueCode;
      charges.push({
        businessDate: c.businessDate,
        amount: decimalToNumber(c.amount),
        qty: c.qty,
        systemRole: rc?.systemRole ?? null,
        isRoomRevenueCode: rc ? isRoomAndTaxRevenueCode(rc) && rc.systemRole !== 'CITY_TAX' : false,
      });
    }
  }
  return charges;
}

/**
 * Upsert commission lines after check-out. Idempotent for ACCRUED/READY/SKIPPED_NET.
 * Does not overwrite PAID / IN_PAYMENT / ON_HOLD / DISPUTED / VOID without force.
 */
export async function accrueOnCheckout(reservationId: string, opts?: { force?: boolean }) {
  const stay = await loadStayForAccrual(reservationId);
  if (!stay) throw Object.assign(new Error('Reservation not found'), { status: 404 });
  if (stay.status !== 'CHECKED_OUT' && !opts?.force) {
    throw Object.assign(new Error('Commission accrues only after check-out'), {
      status: 409,
      code: 'NOT_CHECKED_OUT',
    });
  }

  const slices = slicesFromStay(stay);
  if (slices.length === 0) return { lines: [] as string[], skipped: true as const };

  const computed = buildComputedLines(slices, roomChargesFromStay(stay));
  const orgId = stay.organizationId || requestOrganizationId();
  const ids: string[] = [];

  for (const line of computed) {
    const existing = await prisma.agencyCommissionLine.findUnique({
      where: {
        organizationId_reservationId_periodKey: {
          organizationId: orgId,
          reservationId,
          periodKey: line.periodKey,
        },
      },
    });
    if (existing && TERMINAL_LINE.includes(existing.status) && !opts?.force) {
      ids.push(existing.id);
      continue;
    }
    if (
      existing &&
      (existing.status === 'ON_HOLD' || existing.status === 'DISPUTED') &&
      !opts?.force
    ) {
      ids.push(existing.id);
      continue;
    }

    const data = {
      organizationId: orgId,
      agencyId: line.agencyId,
      reservationId,
      commercialPeriodId: line.commercialPeriodId,
      periodKey: line.periodKey,
      fromDate: line.fromDate,
      toDate: line.toDate,
      revenueBase: toDecimal(line.revenueBase),
      commissionPercent: toDecimal(line.commissionPercent),
      commissionBasis: line.commissionBasis as CommissionBasis,
      amount: toDecimal(line.amount),
      currency: 'AZN',
      status: line.status as AgencyCommissionLineStatus,
      batchId: null,
      financePayableId: null,
      paidAt: null,
      holdReason: null,
      disputedReason: null,
    };

    const row = existing
      ? await prisma.agencyCommissionLine.update({ where: { id: existing.id }, data })
      : await prisma.agencyCommissionLine.create({ data });
    ids.push(row.id);
  }

  return { lines: ids, skipped: false as const };
}

export async function rebuildStay(reservationId: string) {
  return accrueOnCheckout(reservationId, { force: true });
}

export async function rebuildCheckedOutForOrg(opts?: { agencyId?: string }) {
  const stays = await prisma.reservation.findMany({
    where: {
      status: 'CHECKED_OUT',
      agencyId: opts?.agencyId ? opts.agencyId : { not: null },
    },
    select: { id: true },
  });
  let count = 0;
  for (const s of stays) {
    await rebuildStay(s.id);
    count += 1;
  }
  return { rebuilt: count };
}

function parseDay(ymd: string, endOfDay = false): Date {
  if (endOfDay) {
    const d = bakuCivilUtcDate(ymd);
    d.setUTCHours(23, 59, 59, 999);
    return d;
  }
  return bakuCivilUtcDate(ymd);
}

export async function listCommissionSummary(fromYmd: string, toYmd: string) {
  const from = parseDay(fromYmd);
  const to = parseDay(toYmd, true);
  const lines = await prisma.agencyCommissionLine.findMany({
    where: {
      fromDate: { lte: to },
      toDate: { gte: from },
      status: { not: 'VOID' },
    },
    include: { agency: { select: { id: true, code: true, name: true, commissionPercent: true } } },
  });

  type Agg = {
    agencyId: string;
    code: string;
    name: string;
    commissionPercent: number | null;
    accrued: number;
    ready: number;
    inPayment: number;
    paid: number;
    held: number;
    skippedNet: number;
    lineCount: number;
  };
  const map = new Map<string, Agg>();
  for (const line of lines) {
    const row =
      map.get(line.agencyId) ??
      ({
        agencyId: line.agencyId,
        code: line.agency.code,
        name: line.agency.name,
        commissionPercent:
          line.agency.commissionPercent != null
            ? decimalToNumber(line.agency.commissionPercent)
            : null,
        accrued: 0,
        ready: 0,
        inPayment: 0,
        paid: 0,
        held: 0,
        skippedNet: 0,
        lineCount: 0,
      } satisfies Agg);
    const amt = decimalToNumber(line.amount);
    row.lineCount += 1;
    if (line.status === 'ACCRUED') row.accrued += amt;
    else if (line.status === 'READY') row.ready += amt;
    else if (line.status === 'IN_PAYMENT') row.inPayment += amt;
    else if (line.status === 'PAID') row.paid += amt;
    else if (line.status === 'ON_HOLD' || line.status === 'DISPUTED') row.held += amt;
    else if (line.status === 'SKIPPED_NET') row.skippedNet += 1;
    map.set(line.agencyId, row);
  }

  return [...map.values()]
    .map((r) => ({
      ...r,
      accrued: Math.round(r.accrued * 100) / 100,
      ready: Math.round(r.ready * 100) / 100,
      inPayment: Math.round(r.inPayment * 100) / 100,
      paid: Math.round(r.paid * 100) / 100,
      held: Math.round(r.held * 100) / 100,
      payable: Math.round((r.accrued + r.ready) * 100) / 100,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

export async function listCommissionLines(input: {
  agencyId?: string;
  fromYmd: string;
  toYmd: string;
  status?: AgencyCommissionLineStatus;
}) {
  const from = parseDay(input.fromYmd);
  const to = parseDay(input.toYmd, true);
  const lines = await prisma.agencyCommissionLine.findMany({
    where: {
      ...(input.agencyId ? { agencyId: input.agencyId } : {}),
      ...(input.status ? { status: input.status } : { status: { not: 'VOID' } }),
      fromDate: { lte: to },
      toDate: { gte: from },
    },
    include: {
      agency: { select: { code: true, name: true } },
      reservation: {
        select: {
          id: true,
          externalRef: true,
          checkInDate: true,
          checkOutDate: true,
          guest: { select: { fullName: true } },
          room: { select: { roomNumber: true } },
        },
      },
    },
    orderBy: [{ fromDate: 'asc' }, { createdAt: 'asc' }],
  });

  return lines.map((l) => ({
    id: l.id,
    agencyId: l.agencyId,
    agencyCode: l.agency.code,
    agencyName: l.agency.name,
    reservationId: l.reservationId,
    reservationRef: l.reservation.externalRef,
    guestName: l.reservation.guest?.fullName ?? null,
    roomLabel: l.reservation.room?.roomNumber ?? null,
    fromDate: hotelDateKey(l.fromDate),
    toDate: hotelDateKey(l.toDate),
    revenueBase: decimalToNumber(l.revenueBase),
    commissionPercent: decimalToNumber(l.commissionPercent),
    commissionBasis: l.commissionBasis,
    amount: decimalToNumber(l.amount),
    status: l.status,
    batchId: l.batchId,
    holdReason: l.holdReason,
    disputedReason: l.disputedReason,
  }));
}

export async function markLinesReady(lineIds: string[]) {
  if (lineIds.length === 0) return { updated: 0 };
  const result = await prisma.agencyCommissionLine.updateMany({
    where: { id: { in: lineIds }, status: 'ACCRUED' },
    data: { status: 'READY' },
  });
  return { updated: result.count };
}

export async function createCommissionBatch(input: {
  agencyId: string;
  periodFromYmd: string;
  periodToYmd: string;
  lineIds?: string[];
}) {
  const from = parseDay(input.periodFromYmd);
  const to = parseDay(input.periodToYmd, true);
  const lines = await prisma.agencyCommissionLine.findMany({
    where: {
      agencyId: input.agencyId,
      status: 'READY',
      ...(input.lineIds?.length ? { id: { in: input.lineIds } } : {}),
      fromDate: { lte: to },
      toDate: { gte: from },
    },
  });
  if (lines.length === 0) {
    throw Object.assign(new Error('No READY commission lines for batch'), {
      status: 409,
      code: 'NO_READY_LINES',
    });
  }
  const total = lines.reduce((s, l) => s + decimalToNumber(l.amount), 0);
  const orgId = lines[0]!.organizationId;
  const batch = await prisma.agencyCommissionBatch.create({
    data: {
      organizationId: orgId,
      agencyId: input.agencyId,
      periodFrom: from,
      periodTo: bakuCivilUtcDate(input.periodToYmd),
      totalAmount: toDecimal(Math.round(total * 100) / 100),
      status: 'DRAFT',
    },
  });
  await prisma.agencyCommissionLine.updateMany({
    where: { id: { in: lines.map((l) => l.id) } },
    data: { batchId: batch.id },
  });
  return batch;
}

export async function submitCommissionBatch(batchId: string) {
  const batch = await prisma.agencyCommissionBatch.findUnique({
    where: { id: batchId },
    include: {
      agency: true,
      lines: true,
    },
  });
  if (!batch) throw Object.assign(new Error('Batch not found'), { status: 404 });
  if (batch.status !== 'DRAFT') {
    throw Object.assign(new Error('Batch already submitted'), {
      status: 409,
      code: 'BATCH_NOT_DRAFT',
    });
  }
  const blocked = batch.lines.filter(
    (l) => l.status === 'ON_HOLD' || l.status === 'DISPUTED' || l.status === 'VOID',
  );
  if (blocked.length > 0) {
    throw Object.assign(new Error('Batch has held or disputed lines'), {
      status: 409,
      code: 'BATCH_HAS_BLOCKED_LINES',
    });
  }

  const correlationId = randomUUID();
  const { dispatchAgencyCommissionPayable } = await import('@/lib/integration/event-dispatcher');
  const dispatch = await dispatchAgencyCommissionPayable({
    agencyId: batch.agencyId,
    agencyCode: batch.agency.code,
    batchId: batch.id,
    asOfDate: todayBakuYmd(),
    totalAmount: decimalToNumber(batch.totalAmount),
    lineCount: batch.lines.length,
    financeCounterpartyId: batch.agency.financeCounterpartyId ?? undefined,
    correlationId,
  });
  if (!dispatch.dispatched && !dispatch.skipped) {
    throw Object.assign(new Error(dispatch.error ?? 'Commission payable event failed'), {
      status: 502,
      code: 'COMMISSION_EVENT_FAILED',
    });
  }

  await prisma.$transaction([
    prisma.agencyCommissionBatch.update({
      where: { id: batchId },
      data: {
        status: 'SUBMITTED' as AgencyCommissionBatchStatus,
        correlationId: dispatch.correlationId || correlationId,
        submittedAt: new Date(),
      },
    }),
    prisma.agencyCommissionLine.updateMany({
      where: { batchId, status: { in: ['READY', 'ACCRUED'] } },
      data: { status: 'IN_PAYMENT' },
    }),
  ]);

  return { batchId, correlationId: dispatch.correlationId || correlationId };
}

/** Hotel never pays commission from cash — Finance only. */
export function refuseHotelCommissionPay(): never {
  throw Object.assign(new Error('Agency commission is paid in Finance only (AP handoff).'), {
    status: 409,
    code: 'FINANCE_ONLY_COMMISSION_PAY',
  });
}

export async function holdCommissionLine(lineId: string, reason: string) {
  const r = reason.trim();
  if (!r) throw Object.assign(new Error('Hold reason required'), { status: 400 });
  const line = await prisma.agencyCommissionLine.findUnique({ where: { id: lineId } });
  if (!line) throw Object.assign(new Error('Line not found'), { status: 404 });
  if (line.status === 'PAID' || line.status === 'IN_PAYMENT') {
    throw Object.assign(new Error('Cannot hold paid or in-payment line'), {
      status: 409,
      code: 'LINE_LOCKED',
    });
  }
  return prisma.agencyCommissionLine.update({
    where: { id: lineId },
    data: { status: 'ON_HOLD', holdReason: r, disputedReason: null },
  });
}

export async function disputeCommissionLine(lineId: string, reason: string) {
  const r = reason.trim();
  if (!r) throw Object.assign(new Error('Dispute reason required'), { status: 400 });
  const line = await prisma.agencyCommissionLine.findUnique({ where: { id: lineId } });
  if (!line) throw Object.assign(new Error('Line not found'), { status: 404 });
  if (line.status === 'PAID') {
    throw Object.assign(new Error('Cannot dispute paid line'), { status: 409, code: 'LINE_LOCKED' });
  }
  return prisma.agencyCommissionLine.update({
    where: { id: lineId },
    data: { status: 'DISPUTED', disputedReason: r },
  });
}

export async function releaseCommissionHold(lineId: string) {
  const line = await prisma.agencyCommissionLine.findUnique({ where: { id: lineId } });
  if (!line) throw Object.assign(new Error('Line not found'), { status: 404 });
  if (line.status !== 'ON_HOLD' && line.status !== 'DISPUTED') {
    throw Object.assign(new Error('Line is not held or disputed'), { status: 409 });
  }
  return prisma.agencyCommissionLine.update({
    where: { id: lineId },
    data: {
      status: 'ACCRUED',
      holdReason: null,
      disputedReason: null,
    },
  });
}

export async function applyCommissionPaid(input: {
  batchId?: string;
  lineIds?: string[];
  financePayableId: string;
  paymentRef: string;
}) {
  if (!input.batchId && (!input.lineIds || input.lineIds.length === 0)) {
    throw Object.assign(new Error('batchId or lineIds required'), { status: 400 });
  }
  const now = new Date();
  if (input.batchId) {
    await prisma.agencyCommissionBatch.update({
      where: { id: input.batchId },
      data: {
        status: 'PAID',
        paidAt: now,
        financePayableId: input.financePayableId,
      },
    });
    await prisma.agencyCommissionLine.updateMany({
      where: { batchId: input.batchId, status: { in: ['IN_PAYMENT', 'READY'] } },
      data: {
        status: 'PAID',
        paidAt: now,
        financePayableId: input.financePayableId,
      },
    });
    return { ok: true, paymentRef: input.paymentRef };
  }
  await prisma.agencyCommissionLine.updateMany({
    where: { id: { in: input.lineIds! }, status: { in: ['IN_PAYMENT', 'READY', 'ACCRUED'] } },
    data: {
      status: 'PAID',
      paidAt: now,
      financePayableId: input.financePayableId,
    },
  });
  return { ok: true, paymentRef: input.paymentRef };
}

export async function applyCommissionOffset(input: {
  lineIds: string[];
  financeOffsetId: string;
}) {
  if (input.lineIds.length === 0) {
    throw Object.assign(new Error('lineIds required'), { status: 400 });
  }
  const now = new Date();
  await prisma.agencyCommissionLine.updateMany({
    where: {
      id: { in: input.lineIds },
      status: { in: ['ACCRUED', 'READY', 'IN_PAYMENT', 'ON_HOLD'] },
    },
    data: {
      status: 'PAID',
      paidAt: now,
      financePayableId: input.financeOffsetId,
      holdReason: null,
      disputedReason: null,
    },
  });
  return { ok: true };
}

export async function forecastAgencyCommission(fromYmd: string, toYmd: string) {
  const from = parseDay(fromYmd);
  const to = parseDay(toYmd, true);
  const stays = await prisma.reservation.findMany({
    where: {
      agencyId: { not: null },
      status: { in: ['OPTION', 'CONFIRMED', 'IN_HOUSE'] },
      checkInDate: { lte: to },
      checkOutDate: { gte: from },
    },
    include: {
      agency: true,
      salesContract: { select: { commissionPercent: true } },
      dailyRates: true,
    },
  });

  type Row = {
    agencyId: string;
    code: string;
    name: string;
    nights: number;
    revenue: number;
    estCommission: number;
    stays: number;
  };
  const map = new Map<string, Row>();

  for (const stay of stays) {
    if (!stay.agencyId || !stay.agency) continue;
    const pct = resolvePercent(
      stay.salesContract?.commissionPercent != null
        ? decimalToNumber(stay.salesContract.commissionPercent)
        : null,
      stay.agency.commissionPercent != null ? decimalToNumber(stay.agency.commissionPercent) : null,
    );
    const rateByDate = new Map(
      stay.dailyRates.map((d) => [hotelDateKey(d.stayDate), decimalToNumber(d.amount)]),
    );
    let nights = 0;
    let revenue = 0;
    const ci = hotelDateKey(stay.checkInDate);
    const co = hotelDateKey(stay.checkOutDate);
    let cursor = ci;
    while (cursor < co) {
      const noon = bakuCivilUtcDate(cursor);
      if (noon >= from && noon <= to) {
        nights += 1;
        const nightly =
          rateByDate.get(cursor) ??
          (stay.dailyRates.length > 0
            ? 0
            : decimalToNumber(stay.totalAmount) /
              Math.max(1, Math.ceil((stay.checkOutDate.getTime() - stay.checkInDate.getTime()) / 86400000)));
        revenue += nightly;
      }
      const next = new Date(noon);
      next.setUTCDate(next.getUTCDate() + 1);
      cursor = hotelDateKey(next);
    }
    const est = forecastCommissionAmount(nights, nights > 0 ? revenue / nights : 0, pct, stay.commissionBasis);
    const row =
      map.get(stay.agencyId) ??
      ({
        agencyId: stay.agencyId,
        code: stay.agency.code,
        name: stay.agency.name,
        nights: 0,
        revenue: 0,
        estCommission: 0,
        stays: 0,
      } satisfies Row);
    row.nights += nights;
    row.revenue += revenue;
    row.estCommission += est;
    row.stays += 1;
    map.set(stay.agencyId, row);
  }

  return [...map.values()]
    .map((r) => ({
      ...r,
      revenue: Math.round(r.revenue * 100) / 100,
      estCommission: Math.round(r.estCommission * 100) / 100,
    }))
    .sort((a, b) => b.estCommission - a.estCommission);
}
