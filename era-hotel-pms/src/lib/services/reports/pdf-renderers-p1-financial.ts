import { createReportDoc, renderHeader, renderTable, finishDoc, type PdfTableColumn } from '@/lib/reports/pdf-render';
import { formatReportTimestamp } from '@/lib/reports/pdf-i18n';
import type { RenderCtx } from './pdf-renderers';
import type {
  TrialBalanceResult, DepartmentPaymentsResult, CumulativeRevenueResult,
  DeptCurrencyResult, DiscountsResult, TransferredDiscountsResult, DeptPivotResult,
} from './financial-p1.report';

function fmt(n: number): string { return n.toFixed(2); }
function docCtx(ctx: RenderCtx) { return { ...ctx, generatedAt: formatReportTimestamp(ctx.locale), landscape: true as const }; }

export async function renderTrialBalancePdf(data: TrialBalanceResult, ctx: RenderCtx): Promise<Buffer> {
  const doc = createReportDoc(docCtx(ctx));
  renderHeader(doc, docCtx(ctx));
  const cols: PdfTableColumn[] = [
    { header: 'Department', width: 200, align: 'left' },
    { header: 'Debit', width: 100, align: 'right' },
    { header: 'Credit', width: 100, align: 'right' },
    { header: 'Balance', width: 100, align: 'right' },
  ];
  const rows = data.rows.map((r) => [r.departmentName, fmt(r.debit), fmt(r.credit), fmt(r.balance)]);
  rows.push(['TOTAL', fmt(data.totalDebit), fmt(data.totalCredit), fmt(data.totalBalance)]);
  renderTable(doc, cols, rows, { groupHeaders: ['TOTAL'] });
  return finishDoc(doc);
}

export async function renderDepartmentPaymentsPdf(data: DepartmentPaymentsResult, ctx: RenderCtx): Promise<Buffer> {
  const doc = createReportDoc(docCtx(ctx));
  renderHeader(doc, docCtx(ctx));
  const cols: PdfTableColumn[] = [
    { header: 'Department', width: 150, align: 'left' },
    { header: 'Method', width: 120, align: 'left' },
    { header: 'Count', width: 70, align: 'right' },
    { header: 'Total', width: 100, align: 'right' },
  ];
  const rows = data.rows.map((r) => [r.departmentName, r.paymentMethod, r.count, fmt(r.total)]);
  rows.push(['TOTAL', '', '', fmt(data.grandTotal)]);
  renderTable(doc, cols, rows, { groupHeaders: ['TOTAL'] });
  return finishDoc(doc);
}

export async function renderCumulativeRevenuePdf(data: CumulativeRevenueResult, ctx: RenderCtx): Promise<Buffer> {
  const doc = createReportDoc(docCtx(ctx));
  renderHeader(doc, docCtx(ctx));
  const cols: PdfTableColumn[] = [
    { header: 'Date', width: 100, align: 'left' },
    { header: 'Department', width: 140, align: 'left' },
    { header: 'Daily', width: 100, align: 'right' },
    { header: 'Cumulative', width: 100, align: 'right' },
  ];
  renderTable(doc, cols, data.rows.map((r) => [r.date, r.departmentName, fmt(r.dailyAmount), fmt(r.cumulativeAmount)]));
  return finishDoc(doc);
}

export async function renderDeptCurrencyPdf(data: DeptCurrencyResult, ctx: RenderCtx): Promise<Buffer> {
  const doc = createReportDoc(docCtx(ctx));
  renderHeader(doc, docCtx(ctx));
  const cols: PdfTableColumn[] = [
    { header: 'Department', width: 160, align: 'left' },
    { header: 'Currency', width: 80, align: 'center' },
    { header: 'Total', width: 120, align: 'right' },
  ];
  renderTable(doc, cols, data.rows.map((r) => [r.departmentName, r.currencyCode, fmt(r.total)]));
  return finishDoc(doc);
}

export async function renderDiscountsPdf(data: DiscountsResult, ctx: RenderCtx): Promise<Buffer> {
  const doc = createReportDoc(docCtx(ctx));
  renderHeader(doc, docCtx(ctx));
  const cols: PdfTableColumn[] = [
    { header: 'Guest', width: 160, align: 'left' },
    { header: 'Room', width: 70, align: 'center' },
    { header: 'Description', width: 200, align: 'left' },
    { header: 'Amount', width: 100, align: 'right' },
  ];
  const rows = data.rows.map((r) => [r.guestName, r.roomNumber ?? '', r.description, fmt(r.amount)]);
  rows.push(['TOTAL', '', '', fmt(data.totalDiscount)]);
  renderTable(doc, cols, rows, { groupHeaders: ['TOTAL'] });
  return finishDoc(doc);
}

export async function renderTransferredDiscountsPdf(data: TransferredDiscountsResult, ctx: RenderCtx): Promise<Buffer> {
  const doc = createReportDoc(docCtx(ctx));
  renderHeader(doc, docCtx(ctx));
  const cols: PdfTableColumn[] = [
    { header: 'From Dept', width: 140, align: 'left' },
    { header: 'To Dept', width: 140, align: 'left' },
    { header: 'Guest', width: 160, align: 'left' },
    { header: 'Amount', width: 100, align: 'right' },
  ];
  const rows = data.rows.map((r) => [r.fromDepartment, r.toDepartment, r.guestName, fmt(r.amount)]);
  rows.push(['TOTAL', '', '', fmt(data.total)]);
  renderTable(doc, cols, rows, { groupHeaders: ['TOTAL'] });
  return finishDoc(doc);
}

export async function renderDeptPivotPdf(data: DeptPivotResult, ctx: RenderCtx): Promise<Buffer> {
  const doc = createReportDoc(docCtx(ctx));
  renderHeader(doc, docCtx(ctx));
  const rcCodes = data.revenueCodes.map((rc) => rc.code);
  const cols: PdfTableColumn[] = [
    { header: 'Department', width: 140, align: 'left' },
    ...rcCodes.map((code) => ({ header: code, width: 80, align: 'right' as const })),
    { header: 'Total', width: 90, align: 'right' },
  ];
  const rows = data.rows.map((r) => [
    r.departmentName,
    ...rcCodes.map((c) => fmt(r.revenueByCode[c] ?? 0)),
    fmt(r.total),
  ]);
  rows.push(['TOTAL', ...rcCodes.map(() => ''), fmt(data.grandTotal)]);
  renderTable(doc, cols, rows, { groupHeaders: ['TOTAL'] });
  return finishDoc(doc);
}
