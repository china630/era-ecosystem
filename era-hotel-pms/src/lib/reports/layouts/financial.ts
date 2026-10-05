import { bakuDateTimeDisplay, bakuTimeLabel } from '@era/satellite-kit/time';
import type { TrialBalancePeriodResult } from '@/lib/services/reports/trial-balance-period.service';
import type { CashReportResult } from '@/lib/services/reports/cash-report.service';
import type { FolioTransactionsResult } from '@/lib/services/reports/folio-transactions.service';
import type { DepartmentRevenuesResult, RevenueAmounts } from '@/lib/services/reports/department-revenues.service';
import type {
  CumulativeRevenueResult,
  DepartmentPaymentsResult,
  DeptCurrencyResult,
  DeptPivotResult,
  DiscountsResult,
  TransferredDiscountsResult,
} from '@/lib/services/reports/financial-p1.report';
import type { LayoutColumn, LayoutRow, ReportLayout } from '../layout';
import { col, colLabel, pivot, matrixSection, row, section, secTitle, sum, totalRow, valueLabel, type LayoutCtx } from './common';

/** Trial balance: B/F, departments (Net / VAT / Total) with revenue codes, payments negative, closing balance. */
export function buildTrialBalanceLayout(slug: string, data: TrialBalancePeriodResult, ctx: LayoutCtx): ReportLayout {
  const columns: LayoutColumn[] = [
    col(ctx, 'code', 'text', 0.8),
    col(ctx, 'description', 'text', 2.4),
    col(ctx, 'net', 'money'),
    col(ctx, 'vat', 'money'),
    col(ctx, 'gross', 'money'),
  ];
  const rows: LayoutRow[] = [row(['', colLabel(ctx, 'balanceForward'), '', '', data.openingBalance], 'subtotal')];
  for (const d of data.departments) {
    rows.push(row([d.code, d.name, d.net, d.vat, d.gross], 'group'));
    for (const l of d.codes) rows.push(row([l.code, l.name, l.net, l.vat, l.gross]));
  }
  rows.push(row(['', colLabel(ctx, 'chargesTotal'), data.chargesNet, data.chargesVat, data.chargesGross], 'subtotal'));
  for (const p of data.payments) rows.push(row(['', valueLabel(ctx, 'pay', p.method), '', '', -p.amount]));
  rows.push(row(['', colLabel(ctx, 'paymentsTotal'), '', '', -data.paymentsTotal], 'subtotal'));
  rows.push(row(['', colLabel(ctx, 'closingBalance'), '', '', data.closingBalance], 'total'));
  return { slug, sections: [section('ledger', columns, rows)] };
}

export function buildCashReportLayout(slug: string, data: CashReportResult, ctx: LayoutCtx): ReportLayout {
  const multiDay = data.from !== data.to;
  const txColumns: LayoutColumn[] = [
    col(ctx, 'no', 'int', 0.4),
    col(ctx, 'time', 'datetime', multiDay ? 1.4 : 0.7),
    col(ctx, 'room', 'text', 0.6),
    col(ctx, 'guest', 'text', 2),
    col(ctx, 'paymentMethod'),
    col(ctx, 'reference'),
    col(ctx, 'cashier'),
    col(ctx, 'amount', 'money'),
  ];
  const txRows: LayoutRow[] = data.rows.map((r, i) =>
    row([
      i + 1,
      multiDay ? bakuDateTimeDisplay(r.time) : bakuTimeLabel(r.time),
      r.roomNumber ?? '',
      r.guestName ?? '',
      `${valueLabel(ctx, 'pay', r.paymentMethod)}${r.kind === 'REFUND' ? ` · ${valueLabel(ctx, 'kind', 'REFUND')}` : ''}`,
      r.reference ?? '',
      r.cashier ?? '',
      r.amount,
    ]),
  );
  if (txRows.length > 0) txRows.push(row(['', '', '', colLabel(ctx, 'total'), '', '', '', data.grandTotal], 'total'));

  const methodColumns: LayoutColumn[] = [col(ctx, 'paymentMethod', 'text', 2), col(ctx, 'count', 'int'), col(ctx, 'amount', 'money')];
  const methodRows: LayoutRow[] = data.byMethod.map((m) => row([valueLabel(ctx, 'pay', m.method), m.count, m.amount]));
  if (methodRows.length > 0) methodRows.push(totalRow(ctx, [sum(data.byMethod, (m) => m.count), data.grandTotal]));

  return {
    slug,
    sections: [
      section('transactions', txColumns, txRows, secTitle(ctx, 'transactions')),
      section('byMethod', methodColumns, methodRows, secTitle(ctx, 'byMethod')),
    ],
  };
}

/** Per folio: group header, transactions with running balance, folio subtotal; grand total at the end. */
export function buildFolioTransactionsLayout(slug: string, data: FolioTransactionsResult, ctx: LayoutCtx): ReportLayout {
  const columns: LayoutColumn[] = [
    col(ctx, 'date', 'date', 0.9),
    col(ctx, 'time', 'text', 0.6),
    col(ctx, 'description', 'text', 2.4),
    col(ctx, 'department', 'text', 1.2),
    col(ctx, 'code', 'text', 0.7),
    col(ctx, 'charge', 'money'),
    col(ctx, 'payment', 'money'),
    col(ctx, 'balance', 'money'),
  ];
  const rows: LayoutRow[] = [];
  let folio = '';
  let charges = 0;
  let payments = 0;
  const closeFolio = () => {
    if (!folio) return;
    rows.push(row(['', '', colLabel(ctx, 'folioTotal'), '', '', charges, payments, Math.round((charges - payments) * 100) / 100], 'subtotal'));
  };
  for (const r of data.rows) {
    if (r.folioId !== folio) {
      closeFolio();
      folio = r.folioId;
      charges = 0;
      payments = 0;
      const head = [r.roomNumber ? `${colLabel(ctx, 'room')} ${r.roomNumber}` : '', r.guestName ?? '', `#${r.folioId.slice(0, 8)}`]
        .filter(Boolean)
        .join(' · ');
      rows.push(row(['', '', head, '', '', '', '', ''], 'group'));
    }
    charges = Math.round((charges + r.charge) * 100) / 100;
    payments = Math.round((payments + r.payment) * 100) / 100;
    rows.push(
      row([
        r.businessDate,
        bakuTimeLabel(r.time),
        r.description,
        r.department ?? '',
        r.revenueCode ?? '',
        r.charge || '',
        r.payment || '',
        r.balance,
      ]),
    );
  }
  closeFolio();
  if (data.rows.length > 0) {
    rows.push(
      row(['', '', colLabel(ctx, 'total'), '', '', data.totalCharges, data.totalPayments, Math.round((data.totalCharges - data.totalPayments) * 100) / 100], 'total'),
    );
  }
  return { slug, sections: [section('folios', columns, rows)] };
}

/** Department revenues: Today / Month / Year × Net / VAT / Total, departments with revenue code lines. */
export function buildDepartmentRevenuesLayout(slug: string, data: DepartmentRevenuesResult, ctx: LayoutCtx): ReportLayout {
  const periods = ['today', 'month', 'year'] as const;
  const columns: LayoutColumn[] = [col(ctx, 'code', 'text', 0.7), col(ctx, 'description', 'text', 2)];
  for (const p of periods) {
    const label = colLabel(ctx, `period_${p}`);
    columns.push(
      { key: `${p}_net`, label: `${label} · ${colLabel(ctx, 'net')}`, format: 'money' },
      { key: `${p}_vat`, label: `${label} · ${colLabel(ctx, 'vat')}`, format: 'money' },
      { key: `${p}_gross`, label: `${label} · ${colLabel(ctx, 'gross')}`, format: 'money' },
    );
  }
  const amounts = (line: Record<(typeof periods)[number], RevenueAmounts>) =>
    periods.flatMap((p) => [line[p].net, line[p].vat, line[p].gross]);
  const rows: LayoutRow[] = [];
  for (const d of data.departments) {
    rows.push(row([d.code, d.name, ...amounts(d)], 'group'));
    for (const l of d.codes) rows.push(row([l.code, l.name, ...amounts(l)]));
  }
  if (data.departments.length > 0) rows.push(row(['', colLabel(ctx, 'total'), ...amounts(data.total)], 'total'));
  return { slug, sections: [section('departments', columns, rows)] };
}

export function buildDepartmentPaymentsLayout(slug: string, data: DepartmentPaymentsResult, ctx: LayoutCtx): ReportLayout {
  const columns = [col(ctx, 'department', 'text', 1.6), col(ctx, 'paymentMethod', 'text', 1.4), col(ctx, 'count', 'int'), col(ctx, 'amount', 'money')];
  const rows: LayoutRow[] = data.rows.map((r) => row([r.departmentName, valueLabel(ctx, 'pay', r.paymentMethod), r.count, r.total]));
  if (rows.length > 0) rows.push(row([colLabel(ctx, 'total'), '', sum(data.rows, (r) => r.count), data.grandTotal], 'total'));
  return { slug, sections: [section('payments', columns, rows)] };
}

/** Day rows × department columns with running total per department in a second block. */
export function buildCumulativeRevenueLayout(slug: string, data: CumulativeRevenueResult, ctx: LayoutCtx): ReportLayout {
  const daily = pivot(data.rows, (r) => r.date, (r) => r.departmentName, (r) => r.dailyAmount);
  const cumulative = pivot(data.rows, (r) => r.date, (r) => r.departmentName, (r) => r.cumulativeAmount);
  return {
    slug,
    sections: [
      matrixSection(ctx, 'daily', secTitle(ctx, 'daily'), col(ctx, 'date', 'date'), daily, 'money'),
      matrixSection(ctx, 'cumulative', secTitle(ctx, 'cumulative'), col(ctx, 'date', 'date'), cumulative, 'money', undefined, false),
    ],
  };
}

export function buildDeptCurrencyLayout(slug: string, data: DeptCurrencyResult, ctx: LayoutCtx): ReportLayout {
  const m = pivot(data.rows, (r) => r.departmentName, (r) => r.currencyCode, (r) => r.total);
  return { slug, sections: [matrixSection(ctx, 'currency', undefined, col(ctx, 'department', 'text', 2), m, 'money', undefined, false)] };
}

export function buildDiscountsLayout(slug: string, data: DiscountsResult, ctx: LayoutCtx): ReportLayout {
  const columns = [col(ctx, 'room', 'text', 0.6), col(ctx, 'guest', 'text', 2), col(ctx, 'description', 'text', 2.4), col(ctx, 'amount', 'money')];
  const rows: LayoutRow[] = data.rows.map((r) => row([r.roomNumber ?? '', r.guestName, r.description, r.amount]));
  if (rows.length > 0) rows.push(row(['', colLabel(ctx, 'total'), '', data.totalDiscount], 'total'));
  return { slug, sections: [section('discounts', columns, rows)] };
}

export function buildTransferredDiscountsLayout(slug: string, data: TransferredDiscountsResult, ctx: LayoutCtx): ReportLayout {
  const columns = [col(ctx, 'fromDepartment', 'text', 1.4), col(ctx, 'toDepartment', 'text', 1.4), col(ctx, 'guest', 'text', 2), col(ctx, 'amount', 'money')];
  const rows: LayoutRow[] = data.rows.map((r) => row([r.fromDepartment, r.toDepartment, r.guestName, r.amount]));
  if (rows.length > 0) rows.push(row([colLabel(ctx, 'total'), '', '', data.total], 'total'));
  return { slug, sections: [section('transfers', columns, rows)] };
}

export function buildDeptPivotLayout(slug: string, data: DeptPivotResult, ctx: LayoutCtx): ReportLayout {
  const columns: LayoutColumn[] = [
    col(ctx, 'department', 'text', 1.6),
    ...data.revenueCodes.map((rc) => ({ key: rc.code, label: rc.code, format: 'money' as const })),
    col(ctx, 'total', 'money'),
  ];
  const rows: LayoutRow[] = data.rows.map((r) =>
    row([r.departmentName, ...data.revenueCodes.map((rc) => r.revenueByCode[rc.code] ?? ''), r.total]),
  );
  if (rows.length > 0) {
    rows.push(
      totalRow(ctx, [...data.revenueCodes.map((rc) => sum(data.rows, (r) => r.revenueByCode[rc.code])), data.grandTotal]),
    );
  }
  return { slug, sections: [section('pivot', columns, rows)] };
}
