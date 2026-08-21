import { createReportDoc, renderHeader, renderTable, finishDoc, type PdfTableColumn } from '@/lib/reports/pdf-render';
import { formatReportTimestamp } from '@/lib/reports/pdf-i18n';
import type { RenderCtx } from './pdf-renderers';
import type { OccupancyGraphResult } from './occupancy-p1.report';
import type { OccupancyGraphDetailResult } from './occupancy-p1.report';
import type { ForecastWoRevResult } from './occupancy-p1.report';
import type { ForecastBoardResult } from './occupancy-p1.report';
import type { ForecastResult } from './occupancy-p1.report';
import type { ForecastCompareResult } from './occupancy-p1.report';
import type { RoomTypeYoyResult } from './occupancy-p1.report';

function fmt(n: number): string { return n.toFixed(2); }
function pct(n: number): string { return `${n.toFixed(1)}%`; }
function docCtx(ctx: RenderCtx) {
  return { ...ctx, generatedAt: formatReportTimestamp(ctx.locale), landscape: true as const };
}

export async function renderOccupancyGraphPdf(data: OccupancyGraphResult, ctx: RenderCtx): Promise<Buffer> {
  const doc = createReportDoc(docCtx(ctx));
  renderHeader(doc, docCtx(ctx));
  const cols: PdfTableColumn[] = [
    { header: 'Date', width: 100, align: 'left' },
    { header: 'Doors', width: 60, align: 'right' },
    { header: 'Guests', width: 60, align: 'right' },
    { header: 'Available', width: 70, align: 'right' },
    { header: 'Occ %', width: 70, align: 'right' },
  ];
  renderTable(
    doc,
    cols,
    data.rows.map((r) => [r.date, r.roomsSold, r.guestNights, r.roomsAvailable, pct(r.occupancyPct)]),
  );
  return finishDoc(doc);
}

export async function renderOccupancyGraphDetailPdf(data: OccupancyGraphDetailResult, ctx: RenderCtx): Promise<Buffer> {
  const doc = createReportDoc(docCtx(ctx));
  renderHeader(doc, docCtx(ctx));
  const cols: PdfTableColumn[] = [
    { header: 'Date', width: 90, align: 'left' },
    { header: 'Room Type', width: 100, align: 'left' },
    { header: 'Doors', width: 55, align: 'right' },
    { header: 'Guests', width: 55, align: 'right' },
    { header: 'Quota', width: 55, align: 'right' },
    { header: 'Occ %', width: 55, align: 'right' },
  ];
  renderTable(
    doc,
    cols,
    data.rows.map((r) => [r.date, r.roomTypeName, r.sold, r.guestNights, r.quota, pct(r.occupancyPct)]),
  );
  return finishDoc(doc);
}

export async function renderForecastWoRevPdf(data: ForecastWoRevResult, ctx: RenderCtx): Promise<Buffer> {
  const doc = createReportDoc(docCtx(ctx));
  renderHeader(doc, docCtx(ctx));
  const cols: PdfTableColumn[] = [
    { header: 'Date', width: 100, align: 'left' },
    { header: 'Arrivals', width: 70, align: 'right' },
    { header: 'Departures', width: 80, align: 'right' },
    { header: 'Stayovers', width: 80, align: 'right' },
    { header: 'Sold', width: 70, align: 'right' },
    { header: 'Available', width: 80, align: 'right' },
    { header: 'Occ %', width: 70, align: 'right' },
  ];
  renderTable(doc, cols, data.rows.map((r) => [r.date, r.arrivals, r.departures, r.stayovers, r.sold, r.available, pct(r.occupancyPct)]));
  return finishDoc(doc);
}

export async function renderForecastBoardPdf(data: ForecastBoardResult, ctx: RenderCtx): Promise<Buffer> {
  const doc = createReportDoc(docCtx(ctx));
  renderHeader(doc, docCtx(ctx));
  const cols: PdfTableColumn[] = [
    { header: 'Date', width: 100, align: 'left' },
    { header: 'Room Type', width: 120, align: 'left' },
    { header: 'Sold', width: 70, align: 'right' },
    { header: 'Quota', width: 70, align: 'right' },
    { header: 'Available', width: 80, align: 'right' },
  ];
  renderTable(doc, cols, data.rows.map((r) => [r.date, r.roomTypeName, r.sold, r.quota, r.available]));
  return finishDoc(doc);
}

export async function renderForecastPdf(data: ForecastResult, ctx: RenderCtx): Promise<Buffer> {
  const doc = createReportDoc(docCtx(ctx));
  renderHeader(doc, docCtx(ctx));
  const cols: PdfTableColumn[] = [
    { header: 'Date', width: 90, align: 'left' },
    { header: 'Arr', width: 50, align: 'right' },
    { header: 'Dep', width: 50, align: 'right' },
    { header: 'Sold', width: 60, align: 'right' },
    { header: 'Avl', width: 60, align: 'right' },
    { header: 'Occ %', width: 60, align: 'right' },
    { header: 'Revenue', width: 90, align: 'right' },
    { header: 'ADR', width: 80, align: 'right' },
    { header: 'RevPAR', width: 80, align: 'right' },
  ];
  renderTable(doc, cols, data.rows.map((r) => [r.date, r.arrivals, r.departures, r.sold, r.available, pct(r.occupancyPct), fmt(r.revenue), fmt(r.adr), fmt(r.revPar)]));
  return finishDoc(doc);
}

export async function renderForecastComparePdf(data: ForecastCompareResult, ctx: RenderCtx): Promise<Buffer> {
  const doc = createReportDoc(docCtx(ctx));
  renderHeader(doc, docCtx(ctx));
  const cols: PdfTableColumn[] = [
    { header: 'Date', width: 100, align: 'left' },
    { header: 'Cur Sold', width: 80, align: 'right' },
    { header: 'Cur Occ%', width: 70, align: 'right' },
    { header: 'Cur Rev', width: 90, align: 'right' },
    { header: 'Prior Sold', width: 80, align: 'right' },
    { header: 'Prior Occ%', width: 70, align: 'right' },
    { header: 'Prior Rev', width: 90, align: 'right' },
  ];
  renderTable(doc, cols, data.rows.map((r) => [r.date, r.currentSold, pct(r.currentOccPct), fmt(r.currentRevenue), r.priorSold, pct(r.priorOccPct), fmt(r.priorRevenue)]));
  return finishDoc(doc);
}

export async function renderRoomTypeYoyPdf(data: RoomTypeYoyResult, ctx: RenderCtx): Promise<Buffer> {
  const doc = createReportDoc(docCtx(ctx));
  renderHeader(doc, docCtx(ctx));
  const cols: PdfTableColumn[] = [
    { header: 'Room Type', width: 140, align: 'left' },
    { header: 'Current', width: 80, align: 'right' },
    { header: 'Cur Occ%', width: 80, align: 'right' },
    { header: 'Prior', width: 80, align: 'right' },
    { header: 'Prior Occ%', width: 80, align: 'right' },
    { header: 'Change', width: 80, align: 'right' },
  ];
  renderTable(doc, cols, data.rows.map((r) => [r.roomTypeName, r.currentNights, pct(r.currentOccPct), r.priorNights, pct(r.priorOccPct), r.changeNights]));
  return finishDoc(doc);
}
