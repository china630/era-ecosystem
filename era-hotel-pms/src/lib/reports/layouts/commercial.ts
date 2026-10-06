import type {
  AgencyAnalysisResult,
  AgencyForecastMonthResult,
  AgencyMonthlyOccResult,
  AgencyMonthlyResult,
  AgencyNationalityOccResult,
  AgencyNationalityRevResult,
  AgencyProfitabilityResult,
  AgencyRoomTypeOccResult,
  AgencyRoomTypeRevResult,
  NationalityMarketYoyResult,
  NationalityMonthlyOccResult,
  SegmentAnalysisResult,
} from '@/lib/services/reports/agency-p1.report';
import type { DistributionResult, ManagerViewResult, QuotaResult, SalesResult } from '@/lib/services/reports/analysis-p1.report';
import type {
  CancelByCancelResult,
  CancelByCreateResult,
  CrmReportResult,
  DefiniteReservationResult,
  GuestDemographicsResult,
  ReservationSalesResult,
  ReservationsByCreateResult,
} from '@/lib/services/reports/booking-p1.report';
import type { CubeResult } from '@/lib/services/reports/cubes-p2.report';
import type { LayoutColumn, LayoutFormat, LayoutRow, ReportLayout } from '../layout';
import {
  col,
  colLabel,
  matrixSection,
  monthLabel,
  pivot,
  row,
  safeDiv,
  safePct,
  section,
  secTitle,
  sum,
  totalRow,
  valueLabel,
  type LayoutCtx,
} from './common';

const agencyKey = (r: { agencyCode: string; agencyName: string }) => `${r.agencyName} (${r.agencyCode})`;

/** Group rows by a key, one subtotal per group and a grand total; `cells` excludes the first (label) column. */
function groupedRows<T>(
  ctx: LayoutCtx,
  items: T[],
  groupOf: (item: T) => string,
  cells: (item: T) => (string | number | null)[],
  totals: (group: T[]) => (string | number | null)[],
  label: (item: T) => string,
): LayoutRow[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const g = groupOf(item);
    groups.set(g, [...(groups.get(g) ?? []), item]);
  }
  const rows: LayoutRow[] = [];
  for (const [g, list] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    rows.push(row([g, ...totals(list).map(() => '')], 'group'));
    for (const item of list) rows.push(row([label(item), ...cells(item)]));
    rows.push(row([colLabel(ctx, 'subtotal'), ...totals(list)], 'subtotal'));
  }
  if (items.length > 0) rows.push(totalRow(ctx, totals(items)));
  return rows;
}

export function buildAgencyAnalysisLayout(slug: string, data: AgencyAnalysisResult, ctx: LayoutCtx): ReportLayout {
  const columns = [
    col(ctx, 'agency', 'text', 2.2),
    col(ctx, 'roomNights', 'int'),
    col(ctx, 'revenue', 'money'),
    col(ctx, 'adr', 'money'),
    col(ctx, 'commissionPct', 'pct'),
    col(ctx, 'commission', 'money'),
  ];
  const rows: LayoutRow[] = data.rows.map((r) => row([agencyKey(r), r.roomNights, r.revenue, r.avgRate, r.commissionPct, r.commissionAmount]));
  if (rows.length > 0) {
    const nights = sum(data.rows, (r) => r.roomNights);
    rows.push(totalRow(ctx, [nights, data.totalRevenue, safeDiv(data.totalRevenue, nights), '', data.totalCommission]));
  }
  return { slug, sections: [section('agencies', columns, rows)] };
}

export function buildAgencyMonthlyLayout(slug: string, data: AgencyMonthlyResult, ctx: LayoutCtx): ReportLayout {
  const nights = pivot(data.rows, agencyKey, (r) => r.month, (r) => r.roomNights);
  const revenue = pivot(data.rows, agencyKey, (r) => r.month, (r) => r.revenue);
  const header = (m: string) => monthLabel(ctx, m);
  return {
    slug,
    sections: [
      matrixSection(ctx, 'roomNights', secTitle(ctx, 'roomNights'), col(ctx, 'agency', 'text', 2.2), nights, 'int', header),
      matrixSection(ctx, 'revenue', secTitle(ctx, 'revenue'), col(ctx, 'agency', 'text', 2.2), revenue, 'money', header),
    ],
  };
}

export function buildAgencyRoomTypeOccLayout(slug: string, data: AgencyRoomTypeOccResult, ctx: LayoutCtx): ReportLayout {
  const m = pivot(data.rows, agencyKey, (r) => r.roomTypeCode, (r) => r.roomNights);
  return { slug, sections: [matrixSection(ctx, 'roomNights', undefined, col(ctx, 'agency', 'text', 2.2), m, 'int')] };
}

export function buildAgencyMonthlyOccLayout(slug: string, data: AgencyMonthlyOccResult, ctx: LayoutCtx): ReportLayout {
  const nights = pivot(data.rows, agencyKey, (r) => r.month, (r) => r.roomNights);
  const pct = pivot(data.rows, agencyKey, (r) => r.month, (r) => r.occupancyPct);
  const header = (m: string) => monthLabel(ctx, m);
  return {
    slug,
    sections: [
      matrixSection(ctx, 'roomNights', secTitle(ctx, 'roomNights'), col(ctx, 'agency', 'text', 2.2), nights, 'int', header),
      matrixSection(ctx, 'roomPct', secTitle(ctx, 'roomPct'), col(ctx, 'agency', 'text', 2.2), pct, 'pct', header, false),
    ],
  };
}

export function buildAgencyRoomTypeRevLayout(slug: string, data: AgencyRoomTypeRevResult, ctx: LayoutCtx): ReportLayout {
  const m = pivot(data.rows, agencyKey, (r) => r.roomTypeCode, (r) => r.revenue);
  return { slug, sections: [matrixSection(ctx, 'revenue', undefined, col(ctx, 'agency', 'text', 2.2), m, 'money')] };
}

export function buildAgencyNationalityRevLayout(slug: string, data: AgencyNationalityRevResult, ctx: LayoutCtx): ReportLayout {
  const columns = [col(ctx, 'nationality', 'text', 2), col(ctx, 'roomNights', 'int'), col(ctx, 'revenue', 'money')];
  const rows = groupedRows(
    ctx,
    data.rows,
    agencyKey,
    (r) => [r.roomNights, r.revenue],
    (g) => [sum(g, (r) => r.roomNights), sum(g, (r) => r.revenue)],
    (r) => r.nationality,
  );
  return { slug, sections: [section('agencies', columns, rows)] };
}

export function buildAgencyNationalityOccLayout(slug: string, data: AgencyNationalityOccResult, ctx: LayoutCtx): ReportLayout {
  const columns = [col(ctx, 'nationality', 'text', 2), col(ctx, 'roomNights', 'int')];
  const rows = groupedRows(ctx, data.rows, agencyKey, (r) => [r.roomNights], (g) => [sum(g, (r) => r.roomNights)], (r) => r.nationality);
  return { slug, sections: [section('agencies', columns, rows)] };
}

export function buildAgencyForecastMonthLayout(slug: string, data: AgencyForecastMonthResult, ctx: LayoutCtx): ReportLayout {
  const columns = [col(ctx, 'date', 'date', 1.4), col(ctx, 'arrivals', 'int'), col(ctx, 'departures', 'int'), col(ctx, 'roomNights', 'int')];
  const rows = groupedRows(
    ctx,
    data.rows,
    agencyKey,
    (r) => [r.expectedArrivals, r.expectedDepartures, r.roomNights],
    (g) => [sum(g, (r) => r.expectedArrivals), sum(g, (r) => r.expectedDepartures), sum(g, (r) => r.roomNights)],
    (r) => r.date,
  );
  return { slug, sections: [section('agencies', columns, rows)] };
}

export function buildSegmentAnalysisLayout(slug: string, data: SegmentAnalysisResult, ctx: LayoutCtx): ReportLayout {
  const columns = [col(ctx, 'segment', 'text', 2), col(ctx, 'roomNights', 'int'), col(ctx, 'revenue', 'money'), col(ctx, 'adr', 'money'), col(ctx, 'share', 'pct')];
  const rows: LayoutRow[] = data.rows.map((r) => row([r.segment, r.roomNights, r.revenue, r.avgRate, r.pctOfTotal]));
  if (rows.length > 0) rows.push(totalRow(ctx, [data.totalNights, data.totalRevenue, safeDiv(data.totalRevenue, data.totalNights), safePct(data.totalNights, data.totalNights)]));
  return { slug, sections: [section('segments', columns, rows)] };
}

export function buildNationalityMonthlyOccLayout(slug: string, data: NationalityMonthlyOccResult, ctx: LayoutCtx): ReportLayout {
  const m = pivot(data.rows, (r) => r.nationality, (r) => r.month, (r) => r.roomNights);
  return { slug, sections: [matrixSection(ctx, 'roomNights', undefined, col(ctx, 'nationality', 'text', 1.6), m, 'int', (k) => monthLabel(ctx, k))] };
}

export function buildNationalityMarketYoyLayout(slug: string, data: NationalityMarketYoyResult, ctx: LayoutCtx): ReportLayout {
  const ly = colLabel(ctx, 'lastYear');
  const columns: LayoutColumn[] = [
    col(ctx, 'market', 'text', 1.6),
    col(ctx, 'roomNights', 'int'),
    { key: 'prior', label: `${colLabel(ctx, 'roomNights')} · ${ly}`, format: 'int' },
    col(ctx, 'change', 'int'),
  ];
  const rows = groupedRows(
    ctx,
    data.rows,
    (r) => r.nationality,
    (r) => [r.currentNights, r.priorNights, r.change],
    (g) => [sum(g, (r) => r.currentNights), sum(g, (r) => r.priorNights), sum(g, (r) => r.change)],
    (r) => r.market,
  );
  return { slug, sections: [section('nationalities', columns, rows)] };
}

export function buildAgencyProfitabilityLayout(slug: string, data: AgencyProfitabilityResult, ctx: LayoutCtx): ReportLayout {
  const columns = [
    col(ctx, 'agency', 'text', 2.2),
    col(ctx, 'roomNights', 'int'),
    col(ctx, 'revenue', 'money'),
    col(ctx, 'commission', 'money'),
    col(ctx, 'netRevenue', 'money'),
    col(ctx, 'netAdr', 'money'),
  ];
  const rows: LayoutRow[] = data.rows.map((r) => row([agencyKey(r), r.roomNights, r.revenue, r.commissionAmount, r.netRevenue, r.avgNetRate]));
  if (rows.length > 0) {
    const nights = sum(data.rows, (r) => r.roomNights);
    rows.push(totalRow(ctx, [nights, data.totalRevenue, data.totalCommission, data.totalNet, safeDiv(data.totalNet, nights)]));
  }
  return { slug, sections: [section('agencies', columns, rows)] };
}

export function buildSalesLayout(slug: string, data: SalesResult, ctx: LayoutCtx): ReportLayout {
  const columns = [col(ctx, 'source', 'text', 2), col(ctx, 'roomNights', 'int'), col(ctx, 'revenue', 'money'), col(ctx, 'adr', 'money')];
  const rows: LayoutRow[] = data.rows.map((r) => row([r.sourceName ? `${r.sourceName} (${r.sourceCode})` : r.sourceCode, r.roomNights, r.revenue, r.avgRate]));
  if (rows.length > 0) rows.push(totalRow(ctx, [data.totalNights, data.totalRevenue, safeDiv(data.totalRevenue, data.totalNights)]));
  return { slug, sections: [section('sources', columns, rows)] };
}

export function buildDistributionLayout(slug: string, data: DistributionResult, ctx: LayoutCtx): ReportLayout {
  const columns = [col(ctx, 'segment', 'text', 2), col(ctx, 'roomNights', 'int'), col(ctx, 'share', 'pct')];
  const rows: LayoutRow[] = data.rows.map((r) => row([r.segment, r.roomNights, r.pctOfTotal]));
  if (rows.length > 0) rows.push(totalRow(ctx, [data.totalNights, safePct(data.totalNights, data.totalNights)]));
  return { slug, sections: [section('segments', columns, rows)] };
}

export function buildQuotaLayout(slug: string, data: QuotaResult, ctx: LayoutCtx): ReportLayout {
  const columns = [col(ctx, 'roomType', 'text', 2), col(ctx, 'quota', 'int'), col(ctx, 'sold', 'int'), col(ctx, 'roomPct', 'pct'), col(ctx, 'variance', 'int')];
  const rows: LayoutRow[] = data.rows.map((r) => row([`${r.roomTypeCode} · ${r.roomTypeName}`, r.quota, r.actualSold, r.actualOccPct, r.variance]));
  if (rows.length > 0) rows.push(totalRow(ctx, [data.totalQuota, data.totalSold, safePct(data.totalSold, data.totalQuota), data.totalSold - data.totalQuota]));
  return { slug, sections: [section('roomTypes', columns, rows)] };
}

export function buildManagerViewLayout(slug: string, data: ManagerViewResult, ctx: LayoutCtx): ReportLayout {
  const metrics: [string, number | null, LayoutFormat][] = [
    ['totalRooms', data.totalRooms, 'int'],
    ['sellableRooms', data.sellableRooms, 'int'],
    ['reservations', data.totalReservations, 'int'],
    ['roomPct', data.occupancyPct, 'pct'],
    ['totalRevenue', data.totalRevenue, 'money'],
    ['adr', data.adr, 'money'],
    ['revPar', data.revPar, 'money'],
    ['arrivals', data.arrivals, 'int'],
    ['departures', data.departures, 'int'],
    ['cancellations', data.cancellations, 'int'],
    ['avgLos', data.avgLos, 'money'],
  ];
  const columns = [col(ctx, 'metric', 'text', 2), col(ctx, 'value', 'money')];
  return { slug, sections: [section('kpi', columns, metrics.map(([k, v, f]) => row([colLabel(ctx, k), v], 'data', f)))] };
}

export function buildReservationSalesLayout(slug: string, data: ReservationSalesResult, ctx: LayoutCtx): ReportLayout {
  const columns = [col(ctx, 'date', 'date'), col(ctx, 'reservations', 'int'), col(ctx, 'roomNights', 'int'), col(ctx, 'revenue', 'money')];
  const rows: LayoutRow[] = data.rows.map((r) => row([r.date, r.newReservations, r.roomNights, r.revenue]));
  if (rows.length > 0) rows.push(totalRow(ctx, [data.totalReservations, sum(data.rows, (r) => r.roomNights), data.totalRevenue]));
  return { slug, sections: [section('days', columns, rows)] };
}

export function buildReservationsByCreateLayout(slug: string, data: ReservationsByCreateResult, ctx: LayoutCtx): ReportLayout {
  const columns = [col(ctx, 'source', 'text', 2), col(ctx, 'reservations', 'int'), col(ctx, 'amount', 'money')];
  const rows = groupedRows(
    ctx,
    data.rows,
    (r) => r.createdDate,
    (r) => [r.reservationCount, r.totalAmount],
    (g) => [sum(g, (r) => r.reservationCount), sum(g, (r) => r.totalAmount)],
    (r) => `${r.sourceName} (${r.sourceCode})`,
  );
  return { slug, sections: [section('days', columns, rows)] };
}

function cancelLayout(
  slug: string,
  ctx: LayoutCtx,
  dateKey: string,
  items: { date: string; guestName: string; roomType: string; checkIn: string; checkOut: string; amount: number }[],
  totalLost: number,
): ReportLayout {
  const columns = [
    col(ctx, dateKey, 'date'),
    col(ctx, 'guest', 'text', 2),
    col(ctx, 'roomType'),
    col(ctx, 'arrival', 'date'),
    col(ctx, 'departure', 'date'),
    col(ctx, 'amount', 'money'),
  ];
  const rows: LayoutRow[] = items.map((r) => row([r.date, r.guestName, r.roomType, r.checkIn, r.checkOut, r.amount]));
  if (rows.length > 0) rows.push(row([colLabel(ctx, 'total'), `${items.length}`, '', '', '', totalLost], 'total'));
  return { slug, sections: [section('cancellations', columns, rows)] };
}

export function buildCancelByCancelLayout(slug: string, data: CancelByCancelResult, ctx: LayoutCtx): ReportLayout {
  return cancelLayout(slug, ctx, 'cancelDate', data.rows.map((r) => ({ ...r, date: r.cancelDate })), data.totalLostRevenue);
}

export function buildCancelByCreateLayout(slug: string, data: CancelByCreateResult, ctx: LayoutCtx): ReportLayout {
  return cancelLayout(slug, ctx, 'createdDate', data.rows.map((r) => ({ ...r, date: r.createdDate })), data.totalLostRevenue);
}

export function buildDefiniteReservationLayout(slug: string, data: DefiniteReservationResult, ctx: LayoutCtx): ReportLayout {
  const columns = [
    col(ctx, 'guest', 'text', 2),
    col(ctx, 'roomType'),
    col(ctx, 'room', 'text', 0.6),
    col(ctx, 'arrival', 'date'),
    col(ctx, 'departure', 'date'),
    col(ctx, 'nights', 'int', 0.6),
    col(ctx, 'rate', 'money'),
    col(ctx, 'agency', 'text', 1.4),
    col(ctx, 'source', 'text', 1.2),
  ];
  const rows: LayoutRow[] = data.rows.map((r) => row([r.guestName, r.roomType, r.roomNumber ?? '', r.checkIn, r.checkOut, r.nights, r.rate, r.agency ?? '', r.source ?? '']));
  if (rows.length > 0) rows.push(row([colLabel(ctx, 'total'), `${data.totalReservations}`, '', '', '', data.totalNights, '', '', ''], 'total'));
  return { slug, sections: [section('reservations', columns, rows)] };
}

export function buildCrmReportLayout(slug: string, data: CrmReportResult, ctx: LayoutCtx): ReportLayout {
  const columns = [
    col(ctx, 'guest', 'text', 2),
    col(ctx, 'nationality'),
    col(ctx, 'visits', 'int'),
    col(ctx, 'spend', 'money'),
    col(ctx, 'vip'),
    col(ctx, 'loyalty'),
    col(ctx, 'lastStay', 'date'),
  ];
  const rows: LayoutRow[] = data.rows.map((r) => row([r.guestName, r.nationality, r.visitCount, r.totalSpend, r.vipType ?? '', r.loyaltyTier ?? '', r.lastStay ?? '']));
  if (rows.length > 0) rows.push(row([colLabel(ctx, 'total'), `${data.rows.length}`, '', sum(data.rows, (r) => r.totalSpend), '', '', ''], 'total'));
  return { slug, sections: [section('guests', columns, rows)] };
}

export function buildGuestDemographicsLayout(slug: string, data: GuestDemographicsResult, ctx: LayoutCtx): ReportLayout {
  const columns = [col(ctx, 'nationality', 'text', 2), col(ctx, 'guests', 'int'), col(ctx, 'share', 'pct')];
  const rows: LayoutRow[] = data.rows.map((r) => row([r.nationality, r.guestCount, r.pctOfTotal]));
  if (rows.length > 0) rows.push(totalRow(ctx, [data.totalGuests, safePct(data.totalGuests, data.totalGuests)]));
  return { slug, sections: [section('nationalities', columns, rows)] };
}

/** Cubes: date rows × dimension columns (amount), plus counts; `date` dimension collapses to one list. */
export function buildCubeLayout(slug: string, data: CubeResult, ctx: LayoutCtx): ReportLayout {
  if (data.dimension === 'date') {
    const columns = [col(ctx, 'date', 'date'), col(ctx, 'count', 'int'), col(ctx, 'amount', 'money')];
    const rows: LayoutRow[] = data.rows.map((r) => row([r.date, r.count, r.amount]));
    if (rows.length > 0) rows.push(totalRow(ctx, [sum(data.rows, (r) => r.count), sum(data.rows, (r) => r.amount)]));
    return { slug, sections: [section('cube', columns, rows)] };
  }
  const dimLabel = valueLabel(ctx, 'dim', data.dimension);
  const amounts = pivot(data.rows, (r) => r.date, (r) => r.dimension, (r) => r.amount);
  const counts = pivot(data.rows, (r) => r.dimension, () => 'count', (r) => r.count);
  return {
    slug,
    sections: [
      matrixSection(ctx, 'amount', `${secTitle(ctx, 'amount')} · ${dimLabel}`, col(ctx, 'date', 'date'), amounts, 'money'),
      matrixSection(ctx, 'count', `${secTitle(ctx, 'count')} · ${dimLabel}`, { key: 'dim', label: dimLabel, format: 'text', weight: 2 }, counts, 'int', () => colLabel(ctx, 'count'), false),
    ],
  };
}
