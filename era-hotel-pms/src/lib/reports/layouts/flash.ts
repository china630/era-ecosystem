import type { FlashColumn, FlashResult } from '@/lib/services/reports/flash.report';
import type { LayoutColumn, LayoutFormat, LayoutRow, LayoutSection, ReportLayout } from '../layout';
import { col, colLabel, row, section, secTitle, valueLabel, type LayoutCtx } from './common';

function periodLabel(ctx: LayoutCtx, c: FlashColumn): string {
  if (c.key === 'period') return c.from === c.to ? c.from : `${c.from} — ${c.to}`;
  return colLabel(ctx, `period_${c.key}`);
}

type Metric = { key: string; format: LayoutFormat; pick: (c: FlashColumn, data: FlashResult) => number | null };

const ROOM_METRICS: Metric[] = [
  { key: 'roomNightsAvailable', format: 'int', pick: (c) => c.roomNightsAvailable },
  { key: 'roomsSold', format: 'int', pick: (c) => c.roomsSold },
  { key: 'complimentary', format: 'int', pick: (c) => c.complimentary },
  { key: 'houseUse', format: 'int', pick: (c) => c.houseUse },
  { key: 'roomPct', format: 'pct', pick: (c) => c.roomPct },
  { key: 'bedPct', format: 'pct', pick: (c) => c.bedPct },
  { key: 'pax', format: 'int', pick: (c) => c.pax },
  { key: 'adults', format: 'int', pick: (c) => c.adults },
  { key: 'children', format: 'int', pick: (c) => c.children },
  { key: 'arrivals', format: 'int', pick: (c) => c.arrivals },
  { key: 'arrivalPax', format: 'int', pick: (c) => c.arrivalPax },
  { key: 'departures', format: 'int', pick: (c) => c.departures },
  { key: 'departurePax', format: 'int', pick: (c) => c.departurePax },
  { key: 'ooo', format: 'int', pick: (c, d) => (c.key === 'today' || c.key === 'period' ? d.ooo : null) },
  { key: 'roomRevenue', format: 'money', pick: (c) => c.roomRevenue },
  { key: 'adr', format: 'money', pick: (c) => c.adr },
  { key: 'revPar', format: 'money', pick: (c) => c.revPar },
];

/** Elektra flash family: KPI block per period, revenue Net/VAT/Total per department, payments by method. */
export function buildFlashLayout(slug: string, data: FlashResult, ctx: LayoutCtx): ReportLayout {
  const kpiColumns: LayoutColumn[] = [
    col(ctx, 'metric', 'text', 2.2),
    ...data.columns.map((c) => ({ key: c.key, label: periodLabel(ctx, c), format: 'int' as const })),
  ];
  const kpiRows: LayoutRow[] = ROOM_METRICS.map((m) =>
    row([colLabel(ctx, m.key), ...data.columns.map((c) => m.pick(c, data))], 'data', m.format),
  );
  const sections: LayoutSection[] = [section('rooms', kpiColumns, kpiRows, secTitle(ctx, 'rooms'))];

  const money = data.columns.filter((c) => !c.forecast);
  if (money.length > 0) {
    const deptCodes = new Map<string, string>();
    for (const c of money) for (const d of c.departments) deptCodes.set(d.code, d.name);
    const revColumns: LayoutColumn[] = [col(ctx, 'department', 'text', 2)];
    for (const c of money) {
      const p = periodLabel(ctx, c);
      revColumns.push(
        { key: `${c.key}_net`, label: `${p} · ${colLabel(ctx, 'net')}`, format: 'money' },
        { key: `${c.key}_vat`, label: `${p} · ${colLabel(ctx, 'vat')}`, format: 'money' },
        { key: `${c.key}_gross`, label: `${p} · ${colLabel(ctx, 'gross')}`, format: 'money' },
      );
    }
    const revRows: LayoutRow[] = [...deptCodes.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([code, name]) =>
        row([
          name,
          ...money.flatMap((c) => {
            const d = c.departments.find((x) => x.code === code);
            return [d?.net ?? 0, d?.vat ?? 0, d?.gross ?? 0];
          }),
        ]),
      );
    revRows.push(
      row([colLabel(ctx, 'total'), ...money.flatMap((c) => [c.totalNet, c.totalVat, c.totalGross])], 'total'),
    );
    sections.push(section('revenue', revColumns, revRows, secTitle(ctx, 'revenue')));

    const methods = new Set<string>();
    for (const c of money) for (const p of c.payments) methods.add(p.method);
    const payColumns: LayoutColumn[] = [
      col(ctx, 'paymentMethod', 'text', 2),
      ...money.map((c) => ({ key: c.key, label: periodLabel(ctx, c), format: 'money' as const })),
    ];
    const payRows: LayoutRow[] = [...methods]
      .sort()
      .map((m) =>
        row([valueLabel(ctx, 'pay', m), ...money.map((c) => c.payments.find((p) => p.method === m)?.amount ?? 0)]),
      );
    payRows.push(row([colLabel(ctx, 'total'), ...money.map((c) => c.paymentsTotal)], 'total'));
    sections.push(section('payments', payColumns, payRows, secTitle(ctx, 'payments')));
  }

  return { slug, sections };
}
