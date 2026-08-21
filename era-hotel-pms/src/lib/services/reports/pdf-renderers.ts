import { createReportDoc, renderHeader, renderTable, finishDoc, type PdfTableColumn } from '@/lib/reports/pdf-render';
import { formatReportTimestamp } from '@/lib/reports/pdf-i18n';
import type { TrialBalancePeriodResult } from './trial-balance-period.service';
import type { CashReportResult } from './cash-report.service';
import type { FolioTransactionsResult } from './folio-transactions.service';
import type { DepartmentRevenuesResult } from './department-revenues.service';
import type { DailyManagementData } from './daily-management.report';
import type { MonthlyDailyRow } from './monthly-daily-analysis.report';
import type { InHouseRow } from './in-house.report';
import type { AnnualOccupancyRow } from './annual-occupancy.report';

export interface RenderCtx {
  propertyName: string;
  locale: string;
  title: string;
  subtitle?: string;
  t?: (key: string) => string;
}

function fmt(n: number): string {
  return n.toFixed(2);
}

export async function renderTrialBalancePeriodPdf(
  data: TrialBalancePeriodResult,
  ctx: RenderCtx,
): Promise<Buffer> {
  const doc = createReportDoc({ ...ctx, generatedAt: formatReportTimestamp(ctx.locale), landscape: true });
  renderHeader(doc, { ...ctx, generatedAt: formatReportTimestamp(ctx.locale), landscape: true });

  const cols: PdfTableColumn[] = [
    { header: 'Department', width: 200, align: 'left' },
    { header: 'B/F', width: 100, align: 'right' },
    { header: 'Debit', width: 100, align: 'right' },
    { header: 'Credit', width: 100, align: 'right' },
    { header: 'Balance', width: 100, align: 'right' },
  ];

  const rows = data.rows.map((r) => [
    r.departmentName,
    fmt(r.bf),
    fmt(r.debit),
    fmt(r.credit),
    fmt(r.balance),
  ]);

  rows.push(['TOTAL', fmt(data.totalBf), fmt(data.totalDebit), fmt(data.totalCredit), fmt(data.totalBalance)]);

  renderTable(doc, cols, rows, { groupHeaders: ['TOTAL'] });
  return finishDoc(doc);
}

export async function renderCashReportPdf(
  data: CashReportResult,
  ctx: RenderCtx,
): Promise<Buffer> {
  const doc = createReportDoc({ ...ctx, generatedAt: formatReportTimestamp(ctx.locale), landscape: true });
  renderHeader(doc, { ...ctx, generatedAt: formatReportTimestamp(ctx.locale), landscape: true });

  const cols: PdfTableColumn[] = [
    { header: '#', width: 40, align: 'right' },
    { header: 'Time', width: 120, align: 'left' },
    { header: 'Guest', width: 160, align: 'left' },
    { header: 'Room', width: 60, align: 'center' },
    { header: 'Amount', width: 90, align: 'right' },
    { header: 'Method', width: 100, align: 'left' },
    { header: 'Cashier', width: 100, align: 'left' },
  ];

  const rows = data.rows.map((r, i) => [
    i + 1,
    r.time.replace('T', ' ').slice(0, 19),
    r.guestName ?? '',
    r.roomNumber ?? '',
    fmt(r.amount),
    r.paymentMethod,
    r.cashier ?? '',
  ]);

  rows.push(['', '', '', 'CASH', fmt(data.totalCash), '', '']);
  rows.push(['', '', '', 'CARD', fmt(data.totalCard), '', '']);
  rows.push(['', '', '', 'CITY', fmt(data.totalCityLedger), '', '']);
  rows.push(['', '', '', 'TOTAL', fmt(data.grandTotal), '', '']);

  renderTable(doc, cols, rows, { groupHeaders: ['TOTAL'] });
  return finishDoc(doc);
}

export async function renderFolioTransactionsPdf(
  data: FolioTransactionsResult,
  ctx: RenderCtx,
): Promise<Buffer> {
  const doc = createReportDoc({ ...ctx, generatedAt: formatReportTimestamp(ctx.locale), landscape: true });
  renderHeader(doc, { ...ctx, generatedAt: formatReportTimestamp(ctx.locale), landscape: true });

  const cols: PdfTableColumn[] = [
    { header: 'Time', width: 110, align: 'left' },
    { header: 'Folio#', width: 80, align: 'left' },
    { header: 'Guest', width: 140, align: 'left' },
    { header: 'Room', width: 50, align: 'center' },
    { header: 'Department', width: 100, align: 'left' },
    { header: 'Charge', width: 80, align: 'right' },
    { header: 'Payment', width: 80, align: 'right' },
    { header: 'Balance', width: 80, align: 'right' },
  ];

  const rows = data.rows.map((r) => [
    r.time.replace('T', ' ').slice(0, 19),
    r.folioId.slice(0, 8),
    r.guestName ?? '',
    r.roomNumber ?? '',
    r.department ?? '',
    r.charge ? fmt(r.charge) : '',
    r.payment ? fmt(r.payment) : '',
    fmt(r.balance),
  ]);

  rows.push(['TOTAL', '', '', '', '', fmt(data.totalCharges), fmt(data.totalPayments), fmt(data.totalCharges - data.totalPayments)]);

  renderTable(doc, cols, rows, { groupHeaders: ['TOTAL'] });
  return finishDoc(doc);
}

export async function renderDepartmentRevenuesPdf(
  data: DepartmentRevenuesResult,
  ctx: RenderCtx,
): Promise<Buffer> {
  const doc = createReportDoc({ ...ctx, generatedAt: formatReportTimestamp(ctx.locale), landscape: true });
  renderHeader(doc, { ...ctx, generatedAt: formatReportTimestamp(ctx.locale), landscape: true });

  const cols: PdfTableColumn[] = [
    { header: 'Department', width: 160, align: 'left' },
    { header: 'Revenue Code', width: 160, align: 'left' },
    { header: 'Count', width: 70, align: 'right' },
    { header: 'Amount', width: 100, align: 'right' },
    { header: '% of Total', width: 80, align: 'right' },
  ];

  const rows = data.rows.map((r) => [
    r.departmentName,
    r.revenueCodeName,
    r.count,
    fmt(r.amount),
    `${r.pctOfTotal.toFixed(1)}%`,
  ]);

  const totalCount = data.rows.reduce((s, r) => s + r.count, 0);
  rows.push(['TOTAL', '', totalCount, fmt(data.grandTotal), '100.0%']);

  renderTable(doc, cols, rows, { groupHeaders: ['TOTAL'] });
  return finishDoc(doc);
}

export async function renderDailyManagementPdf(
  data: DailyManagementData,
  ctx: RenderCtx,
): Promise<Buffer> {
  const doc = createReportDoc({ ...ctx, generatedAt: formatReportTimestamp(ctx.locale), landscape: true });
  renderHeader(doc, { ...ctx, generatedAt: formatReportTimestamp(ctx.locale), landscape: true });

  const s = data.roomStats;
  const statCols: PdfTableColumn[] = [
    { header: 'Metric', width: 200, align: 'left' },
    { header: 'Value', width: 120, align: 'right' },
  ];
  const statRows: (string | number)[][] = [
    ['Total Rooms', s.totalRooms],
    ['Occupied', s.occupied],
    ['Vacant', s.vacant],
    ['OOO', s.ooo],
    ['OOS', s.oos],
    ['Complimentary', s.complimentary],
    ['House Use', s.houseUse],
    ['Occupancy %', `${s.occupancyPct.toFixed(1)}%`],
    ['Average Rate', fmt(s.avgRate)],
    ['RevPAR', fmt(s.revPar)],
    ['Arrivals', data.arrivals],
    ['Departures', data.departures],
    ['In-House Guests', data.inHouseGuests],
  ];
  renderTable(doc, statCols, statRows);

  if (data.revenueSummary.length > 0) {
    doc.moveDown();
    const revCols: PdfTableColumn[] = [
      { header: 'Department', width: 200, align: 'left' },
      { header: 'Revenue', width: 120, align: 'right' },
    ];
    const revRows: (string | number)[][] = data.revenueSummary.map((r) => [r.departmentName, fmt(r.total)]);
    const totalRev = data.revenueSummary.reduce((acc, r) => acc + r.total, 0);
    revRows.push(['TOTAL', fmt(totalRev)]);
    renderTable(doc, revCols, revRows, { groupHeaders: ['TOTAL'] });
  }

  return finishDoc(doc);
}

export async function renderMonthlyDailyAnalysisPdf(
  data: MonthlyDailyRow[],
  ctx: RenderCtx,
): Promise<Buffer> {
  const doc = createReportDoc({ ...ctx, generatedAt: formatReportTimestamp(ctx.locale), landscape: true });
  renderHeader(doc, { ...ctx, generatedAt: formatReportTimestamp(ctx.locale), landscape: true });

  const cols: PdfTableColumn[] = [
    { header: 'Date', width: 100, align: 'left' },
    { header: 'Rooms Sold', width: 90, align: 'right' },
    { header: 'Available', width: 90, align: 'right' },
    { header: 'Occ %', width: 70, align: 'right' },
    { header: 'Revenue', width: 100, align: 'right' },
    { header: 'ADR', width: 80, align: 'right' },
    { header: 'RevPAR', width: 80, align: 'right' },
  ];

  const rows = data.map((r) => [
    r.date, r.roomsSold, r.roomsAvailable,
    `${r.occupancyPct.toFixed(1)}%`, fmt(r.revenue), fmt(r.adr), fmt(r.revPar),
  ]);

  renderTable(doc, cols, rows);
  return finishDoc(doc);
}

export async function renderInHousePdf(
  data: InHouseRow[],
  ctx: RenderCtx,
): Promise<Buffer> {
  const doc = createReportDoc({ ...ctx, generatedAt: formatReportTimestamp(ctx.locale), landscape: true });
  renderHeader(doc, { ...ctx, generatedAt: formatReportTimestamp(ctx.locale), landscape: true });

  const cols: PdfTableColumn[] = [
    { header: 'Room', width: 50, align: 'center' },
    { header: 'Guest', width: 140, align: 'left' },
    { header: 'Arrival', width: 80, align: 'left' },
    { header: 'Departure', width: 80, align: 'left' },
    { header: 'Nights', width: 50, align: 'right' },
    { header: 'Rate', width: 80, align: 'right' },
    { header: 'Agency', width: 100, align: 'left' },
    { header: 'Balance', width: 80, align: 'right' },
  ];

  const rows = data.map((r) => [
    r.roomNumber ?? '', r.guestName, r.arrival.slice(0, 10), r.departure.slice(0, 10),
    r.nights, fmt(r.rate), r.agencyName ?? '', fmt(r.balance),
  ]);

  renderTable(doc, cols, rows);
  return finishDoc(doc);
}

export async function renderAnnualOccupancyPdf(
  data: AnnualOccupancyRow[],
  ctx: RenderCtx,
): Promise<Buffer> {
  const doc = createReportDoc({ ...ctx, generatedAt: formatReportTimestamp(ctx.locale), landscape: true });
  renderHeader(doc, { ...ctx, generatedAt: formatReportTimestamp(ctx.locale), landscape: true });

  const cols: PdfTableColumn[] = [
    { header: 'Month', width: 100, align: 'left' },
    { header: 'Available', width: 90, align: 'right' },
    { header: 'Sold', width: 90, align: 'right' },
    { header: 'Occ %', width: 70, align: 'right' },
    { header: 'Revenue', width: 100, align: 'right' },
    { header: 'ADR', width: 80, align: 'right' },
    { header: 'RevPAR', width: 80, align: 'right' },
  ];

  const rows = data.map((r) => [
    r.month, r.roomsAvailable, r.roomsSold,
    `${r.occupancyPct.toFixed(1)}%`, fmt(r.revenue), fmt(r.adr), fmt(r.revPar),
  ]);

  renderTable(doc, cols, rows);
  return finishDoc(doc);
}

import {
  renderOccupancyGraphPdf, renderOccupancyGraphDetailPdf,
  renderForecastWoRevPdf, renderForecastBoardPdf, renderForecastPdf,
  renderForecastComparePdf, renderRoomTypeYoyPdf,
} from './pdf-renderers-p1-occupancy';
import {
  renderDailyManagementSummaryPdf, renderMainCurrentPdf,
  renderDateRangeManagementPdf,
} from './pdf-renderers-p1-daily';
import {
  renderTrialBalancePdf, renderDepartmentPaymentsPdf,
  renderCumulativeRevenuePdf, renderDeptCurrencyPdf,
  renderDiscountsPdf, renderTransferredDiscountsPdf, renderDeptPivotPdf,
} from './pdf-renderers-p1-financial';
import {
  renderAgencyAnalysisPdf, renderAgencyMonthlyPdf,
  renderAgencyRoomTypeOccPdf, renderAgencyMonthlyOccPdf,
  renderAgencyRoomTypeRevPdf, renderAgencyNationalityRevPdf,
  renderAgencyNationalityOccPdf, renderAgencyForecastMonthPdf,
  renderSegmentAnalysisPdf, renderNationalityMonthlyOccPdf,
  renderNationalityMarketYoyPdf,
} from './pdf-renderers-p1-agency';
import {
  renderReservationSalesPdf, renderReservationsByCreatePdf,
  renderCancelByCancelPdf, renderCancelByCreatePdf,
  renderDefiniteReservationPdf, renderCrmReportPdf,
} from './pdf-renderers-p1-booking';

const PDF_RENDERERS: Record<string, (data: unknown, ctx: RenderCtx) => Promise<Buffer>> = {
  // P0
  'trial-balance-period': renderTrialBalancePeriodPdf as never,
  'cash-report': renderCashReportPdf as never,
  'folio-transactions': renderFolioTransactionsPdf as never,
  'department-revenues': renderDepartmentRevenuesPdf as never,
  'daily-management': renderDailyManagementPdf as never,
  'monthly-daily-analysis': renderMonthlyDailyAnalysisPdf as never,
  'in-house': renderInHousePdf as never,
  'annual-occupancy': renderAnnualOccupancyPdf as never,
  // P1 occupancy
  'occupancy-graph': renderOccupancyGraphPdf as never,
  'occupancy-graph-detail': renderOccupancyGraphDetailPdf as never,
  'forecast-wo-rev': renderForecastWoRevPdf as never,
  'forecast-board': renderForecastBoardPdf as never,
  'forecast': renderForecastPdf as never,
  'forecast-compare': renderForecastComparePdf as never,
  'board-forecast': renderForecastBoardPdf as never,
  'room-type-yoy': renderRoomTypeYoyPdf as never,
  // P1 daily
  'daily-management-summary': renderDailyManagementSummaryPdf as never,
  'main-current': renderMainCurrentPdf as never,
  'date-range-management': renderDateRangeManagementPdf as never,
  // P1 financial
  'trial-balance': renderTrialBalancePdf as never,
  'department-payments': renderDepartmentPaymentsPdf as never,
  'cumulative-revenue': renderCumulativeRevenuePdf as never,
  'dept-currency': renderDeptCurrencyPdf as never,
  'discounts': renderDiscountsPdf as never,
  'transferred-discounts': renderTransferredDiscountsPdf as never,
  'dept-pivot': renderDeptPivotPdf as never,
  // P1 agency
  'agency-analysis': renderAgencyAnalysisPdf as never,
  'agency-monthly': renderAgencyMonthlyPdf as never,
  'agency-room-type-occ': renderAgencyRoomTypeOccPdf as never,
  'agency-monthly-occ': renderAgencyMonthlyOccPdf as never,
  'agency-room-type-rev': renderAgencyRoomTypeRevPdf as never,
  'agency-nationality-rev': renderAgencyNationalityRevPdf as never,
  'agency-nationality-occ': renderAgencyNationalityOccPdf as never,
  'agency-forecast-month': renderAgencyForecastMonthPdf as never,
  'segment-analysis': renderSegmentAnalysisPdf as never,
  'nationality-monthly-occ': renderNationalityMonthlyOccPdf as never,
  'nationality-market-yoy': renderNationalityMarketYoyPdf as never,
  // P1 booking
  'reservation-sales': renderReservationSalesPdf as never,
  'reservations-by-create': renderReservationsByCreatePdf as never,
  'cancel-by-cancel': renderCancelByCancelPdf as never,
  'cancel-by-create': renderCancelByCreatePdf as never,
  'definite-reservation': renderDefiniteReservationPdf as never,
  'crm-report': renderCrmReportPdf as never,
};

export function hasPdfRenderer(slug: string): boolean {
  return slug in PDF_RENDERERS;
}

export function registerPdfRenderer(
  slug: string,
  renderer: (data: unknown, ctx: RenderCtx) => Promise<Buffer>,
): void {
  PDF_RENDERERS[slug] = renderer;
}

export async function renderReportPdf(
  slug: string,
  data: unknown,
  ctx: RenderCtx,
): Promise<Buffer | null> {
  const renderer = PDF_RENDERERS[slug];
  if (renderer) return renderer(data, ctx);
  return renderGenericDataPdf(data, ctx);
}

function asRows(data: unknown): (string | number)[][] {
  if (Array.isArray(data)) {
    return data.map((row) => {
      if (row && typeof row === 'object') return Object.values(row as Record<string, unknown>).map(cellStr);
      return [cellStr(row)];
    });
  }
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.rows)) {
      return (obj.rows as unknown[]).map((row) => {
        if (row && typeof row === 'object') return Object.values(row as Record<string, unknown>).map(cellStr);
        return [cellStr(row)];
      });
    }
    return Object.entries(obj)
      .filter(([, v]) => v == null || typeof v !== 'object')
      .map(([k, v]) => [k, cellStr(v)]);
  }
  return [];
}

function cellStr(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(2);
  if (typeof v === 'boolean') return v ? 'Y' : 'N';
  return String(v);
}

export async function renderGenericDataPdf(data: unknown, ctx: RenderCtx): Promise<Buffer> {
  const doc = createReportDoc({ ...ctx, generatedAt: formatReportTimestamp(ctx.locale), landscape: true });
  renderHeader(doc, { ...ctx, generatedAt: formatReportTimestamp(ctx.locale), landscape: true });

  let headers: string[] = [];
  if (Array.isArray(data) && data[0] && typeof data[0] === 'object') {
    headers = Object.keys(data[0] as object);
  } else if (data && typeof data === 'object' && Array.isArray((data as { rows?: unknown }).rows) && (data as { rows: unknown[] }).rows[0] && typeof (data as { rows: unknown[] }).rows[0] === 'object') {
    headers = Object.keys((data as { rows: object[] }).rows[0]);
  } else {
    headers = ['Field', 'Value'];
  }

  const cols: PdfTableColumn[] = headers.map((h) => ({
    header: h,
    width: Math.max(60, Math.min(160, Math.floor(720 / Math.max(headers.length, 1)))),
    align: 'left' as const,
  }));
  const rows = asRows(data);
  renderTable(doc, cols, rows.length ? rows : [['', 'No data for the selected period']]);
  return finishDoc(doc);
}
