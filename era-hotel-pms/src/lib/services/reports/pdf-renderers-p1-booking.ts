import { createReportDoc, renderHeader, renderTable, finishDoc, type PdfTableColumn } from '@/lib/reports/pdf-render';
import { formatReportTimestamp } from '@/lib/reports/pdf-i18n';
import type { RenderCtx } from './pdf-renderers';
import type {
  ReservationSalesResult, ReservationsByCreateResult,
  CancelByCancelResult, CancelByCreateResult,
  DefiniteReservationResult, CrmReportResult,
} from './booking-p1.report';

function fmt(n: number): string { return n.toFixed(2); }
function docCtx(ctx: RenderCtx) { return { ...ctx, generatedAt: formatReportTimestamp(ctx.locale), landscape: true as const }; }

export async function renderReservationSalesPdf(data: ReservationSalesResult, ctx: RenderCtx): Promise<Buffer> {
  const doc = createReportDoc(docCtx(ctx));
  renderHeader(doc, docCtx(ctx));
  const cols: PdfTableColumn[] = [
    { header: 'Date', width: 100, align: 'left' },
    { header: 'New Res.', width: 80, align: 'right' },
    { header: 'Room Nights', width: 100, align: 'right' },
    { header: 'Revenue', width: 100, align: 'right' },
  ];
  const rows = data.rows.map((r) => [r.date, r.newReservations, r.roomNights, fmt(r.revenue)]);
  rows.push(['TOTAL', data.totalReservations, '', fmt(data.totalRevenue)]);
  renderTable(doc, cols, rows, { groupHeaders: ['TOTAL'] });
  return finishDoc(doc);
}

export async function renderReservationsByCreatePdf(data: ReservationsByCreateResult, ctx: RenderCtx): Promise<Buffer> {
  const doc = createReportDoc(docCtx(ctx));
  renderHeader(doc, docCtx(ctx));
  const cols: PdfTableColumn[] = [
    { header: 'Created', width: 100, align: 'left' },
    { header: 'Source', width: 120, align: 'left' },
    { header: 'Count', width: 70, align: 'right' },
    { header: 'Amount', width: 100, align: 'right' },
  ];
  renderTable(doc, cols, data.rows.map((r) => [r.createdDate, r.sourceName, r.reservationCount, fmt(r.totalAmount)]));
  return finishDoc(doc);
}

export async function renderCancelByCancelPdf(data: CancelByCancelResult, ctx: RenderCtx): Promise<Buffer> {
  const doc = createReportDoc(docCtx(ctx));
  renderHeader(doc, docCtx(ctx));
  const cols: PdfTableColumn[] = [
    { header: 'Cancel Date', width: 100, align: 'left' },
    { header: 'Guest', width: 140, align: 'left' },
    { header: 'Room Type', width: 100, align: 'left' },
    { header: 'Check-in', width: 90, align: 'left' },
    { header: 'Check-out', width: 90, align: 'left' },
    { header: 'Amount', width: 90, align: 'right' },
  ];
  const rows = data.rows.map((r) => [r.cancelDate, r.guestName, r.roomType, r.checkIn, r.checkOut, fmt(r.amount)]);
  rows.push(['TOTAL', `${data.totalCancelled} cancelled`, '', '', '', fmt(data.totalLostRevenue)]);
  renderTable(doc, cols, rows, { groupHeaders: ['TOTAL'] });
  return finishDoc(doc);
}

export async function renderCancelByCreatePdf(data: CancelByCreateResult, ctx: RenderCtx): Promise<Buffer> {
  const doc = createReportDoc(docCtx(ctx));
  renderHeader(doc, docCtx(ctx));
  const cols: PdfTableColumn[] = [
    { header: 'Created', width: 100, align: 'left' },
    { header: 'Guest', width: 140, align: 'left' },
    { header: 'Room Type', width: 100, align: 'left' },
    { header: 'Check-in', width: 90, align: 'left' },
    { header: 'Check-out', width: 90, align: 'left' },
    { header: 'Amount', width: 90, align: 'right' },
  ];
  const rows = data.rows.map((r) => [r.createdDate, r.guestName, r.roomType, r.checkIn, r.checkOut, fmt(r.amount)]);
  rows.push(['TOTAL', `${data.totalCancelled} cancelled`, '', '', '', fmt(data.totalLostRevenue)]);
  renderTable(doc, cols, rows, { groupHeaders: ['TOTAL'] });
  return finishDoc(doc);
}

export async function renderDefiniteReservationPdf(data: DefiniteReservationResult, ctx: RenderCtx): Promise<Buffer> {
  const doc = createReportDoc(docCtx(ctx));
  renderHeader(doc, docCtx(ctx));
  const cols: PdfTableColumn[] = [
    { header: 'Guest', width: 130, align: 'left' },
    { header: 'Type', width: 80, align: 'left' },
    { header: 'Room', width: 60, align: 'center' },
    { header: 'In', width: 80, align: 'left' },
    { header: 'Out', width: 80, align: 'left' },
    { header: 'Nights', width: 50, align: 'right' },
    { header: 'Rate', width: 70, align: 'right' },
    { header: 'Agency', width: 90, align: 'left' },
  ];
  const rows = data.rows.map((r) => [r.guestName, r.roomType, r.roomNumber ?? '', r.checkIn, r.checkOut, r.nights, fmt(r.rate), r.agency ?? '']);
  rows.push(['TOTAL', `${data.totalReservations}`, '', '', '', data.totalNights, '', '']);
  renderTable(doc, cols, rows, { groupHeaders: ['TOTAL'] });
  return finishDoc(doc);
}

export async function renderCrmReportPdf(data: CrmReportResult, ctx: RenderCtx): Promise<Buffer> {
  const doc = createReportDoc(docCtx(ctx));
  renderHeader(doc, docCtx(ctx));
  const cols: PdfTableColumn[] = [
    { header: 'Guest', width: 130, align: 'left' },
    { header: 'Nationality', width: 70, align: 'center' },
    { header: 'Visits', width: 60, align: 'right' },
    { header: 'Total Spend', width: 100, align: 'right' },
    { header: 'VIP', width: 60, align: 'center' },
    { header: 'Loyalty', width: 80, align: 'center' },
    { header: 'Last Stay', width: 90, align: 'left' },
  ];
  renderTable(doc, cols, data.rows.map((r) => [r.guestName, r.nationality, r.visitCount, fmt(r.totalSpend), r.vipType ?? '', r.loyaltyTier ?? '', r.lastStay ?? '']));
  return finishDoc(doc);
}
