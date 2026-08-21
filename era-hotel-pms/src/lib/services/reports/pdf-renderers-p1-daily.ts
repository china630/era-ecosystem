import { createReportDoc, renderHeader, renderTable, finishDoc, type PdfTableColumn } from '@/lib/reports/pdf-render';
import { formatReportTimestamp } from '@/lib/reports/pdf-i18n';
import type { RenderCtx } from './pdf-renderers';
import type { DailyManagementSummaryData, MainCurrentData, DateRangeManagementData } from './daily-p1.report';

function fmt(n: number): string { return n.toFixed(2); }
function docCtx(ctx: RenderCtx) { return { ...ctx, generatedAt: formatReportTimestamp(ctx.locale), landscape: true as const }; }

export async function renderDailyManagementSummaryPdf(data: DailyManagementSummaryData, ctx: RenderCtx): Promise<Buffer> {
  const doc = createReportDoc(docCtx(ctx));
  renderHeader(doc, docCtx(ctx));
  const cols: PdfTableColumn[] = [
    { header: 'Metric', width: 200, align: 'left' },
    { header: 'Value', width: 120, align: 'right' },
  ];
  const rows: (string | number)[][] = [
    ['Business Date', data.businessDate],
    ['Total Rooms', data.totalRooms],
    ['Occupied', data.occupied],
    ['Occupancy %', `${data.occupancyPct.toFixed(1)}%`],
    ['Average Rate', fmt(data.avgRate)],
    ['RevPAR', fmt(data.revPar)],
    ['Total Revenue', fmt(data.totalRevenue)],
    ['Arrivals', data.arrivals],
    ['Departures', data.departures],
  ];
  renderTable(doc, cols, rows);
  return finishDoc(doc);
}

export async function renderMainCurrentPdf(data: MainCurrentData, ctx: RenderCtx): Promise<Buffer> {
  const doc = createReportDoc(docCtx(ctx));
  renderHeader(doc, docCtx(ctx));

  const statCols: PdfTableColumn[] = [
    { header: 'Metric', width: 200, align: 'left' },
    { header: 'Value', width: 120, align: 'right' },
  ];
  const s = data.roomStats;
  renderTable(doc, statCols, [
    ['Occupied', s.occupied],
    ['Occupancy %', `${s.occupancyPct.toFixed(1)}%`],
    ['Arrivals', data.arrivals],
    ['Departures', data.departures],
  ]);

  if (data.inHouseDetails.length > 0) {
    doc.moveDown();
    const detCols: PdfTableColumn[] = [
      { header: 'Guest', width: 160, align: 'left' },
      { header: 'Room', width: 70, align: 'center' },
      { header: 'Type', width: 100, align: 'left' },
      { header: 'Check-in', width: 90, align: 'left' },
      { header: 'Check-out', width: 90, align: 'left' },
    ];
    renderTable(doc, detCols, data.inHouseDetails.map((d) => [d.guestName, d.roomNumber ?? '', d.roomType, d.checkIn, d.checkOut]));
  }

  return finishDoc(doc);
}

export async function renderDateRangeManagementPdf(data: DateRangeManagementData, ctx: RenderCtx): Promise<Buffer> {
  const doc = createReportDoc(docCtx(ctx));
  renderHeader(doc, docCtx(ctx));
  const cols: PdfTableColumn[] = [
    { header: 'Date', width: 100, align: 'left' },
    { header: 'Occupied', width: 80, align: 'right' },
    { header: 'Occ %', width: 70, align: 'right' },
    { header: 'ADR', width: 80, align: 'right' },
    { header: 'RevPAR', width: 80, align: 'right' },
    { header: 'Arrivals', width: 70, align: 'right' },
    { header: 'Departures', width: 80, align: 'right' },
  ];
  renderTable(doc, cols, data.days.map((d) => [
    d.businessDate, d.roomStats.occupied, `${d.roomStats.occupancyPct.toFixed(1)}%`,
    fmt(d.roomStats.avgRate), fmt(d.roomStats.revPar), d.arrivals, d.departures,
  ]));
  return finishDoc(doc);
}
