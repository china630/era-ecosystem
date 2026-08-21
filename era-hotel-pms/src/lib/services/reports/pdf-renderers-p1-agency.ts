import { createReportDoc, renderHeader, renderTable, finishDoc, type PdfTableColumn } from '@/lib/reports/pdf-render';
import { formatReportTimestamp } from '@/lib/reports/pdf-i18n';
import type { RenderCtx } from './pdf-renderers';
import type {
  AgencyAnalysisResult, AgencyMonthlyResult, AgencyRoomTypeOccResult,
  AgencyMonthlyOccResult, AgencyRoomTypeRevResult, AgencyNationalityRevResult,
  AgencyNationalityOccResult, AgencyForecastMonthResult, SegmentAnalysisResult,
  NationalityMonthlyOccResult, NationalityMarketYoyResult,
} from './agency-p1.report';

function fmt(n: number): string { return n.toFixed(2); }
function pct(n: number): string { return `${n.toFixed(1)}%`; }
function docCtx(ctx: RenderCtx) { return { ...ctx, generatedAt: formatReportTimestamp(ctx.locale), landscape: true as const }; }

export async function renderAgencyAnalysisPdf(data: AgencyAnalysisResult, ctx: RenderCtx): Promise<Buffer> {
  const doc = createReportDoc(docCtx(ctx));
  renderHeader(doc, docCtx(ctx));
  const cols: PdfTableColumn[] = [
    { header: 'Agency', width: 150, align: 'left' },
    { header: 'Nights', width: 70, align: 'right' },
    { header: 'Revenue', width: 100, align: 'right' },
    { header: 'Avg Rate', width: 80, align: 'right' },
    { header: 'Comm %', width: 70, align: 'right' },
    { header: 'Commission', width: 100, align: 'right' },
  ];
  const rows = data.rows.map((r) => [r.agencyName, r.roomNights, fmt(r.revenue), fmt(r.avgRate), pct(r.commissionPct), fmt(r.commissionAmount)]);
  rows.push(['TOTAL', '', fmt(data.totalRevenue), '', '', fmt(data.totalCommission)]);
  renderTable(doc, cols, rows, { groupHeaders: ['TOTAL'] });
  return finishDoc(doc);
}

export async function renderAgencyMonthlyPdf(data: AgencyMonthlyResult, ctx: RenderCtx): Promise<Buffer> {
  const doc = createReportDoc(docCtx(ctx));
  renderHeader(doc, docCtx(ctx));
  const cols: PdfTableColumn[] = [
    { header: 'Agency', width: 150, align: 'left' },
    { header: 'Month', width: 100, align: 'left' },
    { header: 'Nights', width: 80, align: 'right' },
    { header: 'Revenue', width: 100, align: 'right' },
  ];
  renderTable(doc, cols, data.rows.map((r) => [r.agencyName, r.month, r.roomNights, fmt(r.revenue)]));
  return finishDoc(doc);
}

export async function renderAgencyRoomTypeOccPdf(data: AgencyRoomTypeOccResult, ctx: RenderCtx): Promise<Buffer> {
  const doc = createReportDoc(docCtx(ctx));
  renderHeader(doc, docCtx(ctx));
  const cols: PdfTableColumn[] = [
    { header: 'Agency', width: 150, align: 'left' },
    { header: 'Room Type', width: 130, align: 'left' },
    { header: 'Nights', width: 80, align: 'right' },
  ];
  renderTable(doc, cols, data.rows.map((r) => [r.agencyName, r.roomTypeName, r.roomNights]));
  return finishDoc(doc);
}

export async function renderAgencyMonthlyOccPdf(data: AgencyMonthlyOccResult, ctx: RenderCtx): Promise<Buffer> {
  const doc = createReportDoc(docCtx(ctx));
  renderHeader(doc, docCtx(ctx));
  const cols: PdfTableColumn[] = [
    { header: 'Agency', width: 150, align: 'left' },
    { header: 'Month', width: 100, align: 'left' },
    { header: 'Nights', width: 80, align: 'right' },
    { header: 'Occ %', width: 80, align: 'right' },
  ];
  renderTable(doc, cols, data.rows.map((r) => [r.agencyName, r.month, r.roomNights, pct(r.occupancyPct)]));
  return finishDoc(doc);
}

export async function renderAgencyRoomTypeRevPdf(data: AgencyRoomTypeRevResult, ctx: RenderCtx): Promise<Buffer> {
  const doc = createReportDoc(docCtx(ctx));
  renderHeader(doc, docCtx(ctx));
  const cols: PdfTableColumn[] = [
    { header: 'Agency', width: 150, align: 'left' },
    { header: 'Room Type', width: 130, align: 'left' },
    { header: 'Revenue', width: 100, align: 'right' },
  ];
  renderTable(doc, cols, data.rows.map((r) => [r.agencyName, r.roomTypeName, fmt(r.revenue)]));
  return finishDoc(doc);
}

export async function renderAgencyNationalityRevPdf(data: AgencyNationalityRevResult, ctx: RenderCtx): Promise<Buffer> {
  const doc = createReportDoc(docCtx(ctx));
  renderHeader(doc, docCtx(ctx));
  const cols: PdfTableColumn[] = [
    { header: 'Agency', width: 140, align: 'left' },
    { header: 'Nationality', width: 100, align: 'left' },
    { header: 'Nights', width: 70, align: 'right' },
    { header: 'Revenue', width: 100, align: 'right' },
  ];
  renderTable(doc, cols, data.rows.map((r) => [r.agencyName, r.nationality, r.roomNights, fmt(r.revenue)]));
  return finishDoc(doc);
}

export async function renderAgencyNationalityOccPdf(data: AgencyNationalityOccResult, ctx: RenderCtx): Promise<Buffer> {
  const doc = createReportDoc(docCtx(ctx));
  renderHeader(doc, docCtx(ctx));
  const cols: PdfTableColumn[] = [
    { header: 'Agency', width: 150, align: 'left' },
    { header: 'Nationality', width: 100, align: 'left' },
    { header: 'Nights', width: 80, align: 'right' },
  ];
  renderTable(doc, cols, data.rows.map((r) => [r.agencyName, r.nationality, r.roomNights]));
  return finishDoc(doc);
}

export async function renderAgencyForecastMonthPdf(data: AgencyForecastMonthResult, ctx: RenderCtx): Promise<Buffer> {
  const doc = createReportDoc(docCtx(ctx));
  renderHeader(doc, docCtx(ctx));
  const cols: PdfTableColumn[] = [
    { header: 'Agency', width: 130, align: 'left' },
    { header: 'Date', width: 90, align: 'left' },
    { header: 'Arrivals', width: 70, align: 'right' },
    { header: 'Departures', width: 80, align: 'right' },
    { header: 'Nights', width: 70, align: 'right' },
  ];
  renderTable(doc, cols, data.rows.map((r) => [r.agencyName, r.date, r.expectedArrivals, r.expectedDepartures, r.roomNights]));
  return finishDoc(doc);
}

export async function renderSegmentAnalysisPdf(data: SegmentAnalysisResult, ctx: RenderCtx): Promise<Buffer> {
  const doc = createReportDoc(docCtx(ctx));
  renderHeader(doc, docCtx(ctx));
  const cols: PdfTableColumn[] = [
    { header: 'Segment', width: 150, align: 'left' },
    { header: 'Nights', width: 80, align: 'right' },
    { header: 'Revenue', width: 100, align: 'right' },
    { header: 'Avg Rate', width: 80, align: 'right' },
    { header: '% Total', width: 70, align: 'right' },
  ];
  const rows = data.rows.map((r) => [r.segment, r.roomNights, fmt(r.revenue), fmt(r.avgRate), pct(r.pctOfTotal)]);
  rows.push(['TOTAL', data.totalNights, fmt(data.totalRevenue), '', '100.0%']);
  renderTable(doc, cols, rows, { groupHeaders: ['TOTAL'] });
  return finishDoc(doc);
}

export async function renderNationalityMonthlyOccPdf(data: NationalityMonthlyOccResult, ctx: RenderCtx): Promise<Buffer> {
  const doc = createReportDoc(docCtx(ctx));
  renderHeader(doc, docCtx(ctx));
  const cols: PdfTableColumn[] = [
    { header: 'Nationality', width: 120, align: 'left' },
    { header: 'Month', width: 100, align: 'left' },
    { header: 'Nights', width: 80, align: 'right' },
  ];
  renderTable(doc, cols, data.rows.map((r) => [r.nationality, r.month, r.roomNights]));
  return finishDoc(doc);
}

export async function renderNationalityMarketYoyPdf(data: NationalityMarketYoyResult, ctx: RenderCtx): Promise<Buffer> {
  const doc = createReportDoc(docCtx(ctx));
  renderHeader(doc, docCtx(ctx));
  const cols: PdfTableColumn[] = [
    { header: 'Nationality', width: 110, align: 'left' },
    { header: 'Market', width: 100, align: 'left' },
    { header: 'Current', width: 80, align: 'right' },
    { header: 'Prior', width: 80, align: 'right' },
    { header: 'Change', width: 80, align: 'right' },
  ];
  renderTable(doc, cols, data.rows.map((r) => [r.nationality, r.market, r.currentNights, r.priorNights, r.change]));
  return finishDoc(doc);
}
