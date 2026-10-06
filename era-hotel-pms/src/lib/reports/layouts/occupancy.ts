import type { OccupancyDay, OccupancySeries } from '@/lib/services/reports/monthly-daily-analysis.report';
import type {
  ForecastBoardResult,
  ForecastCompareResult,
  ForecastResult,
  ForecastWoRevResult,
  OccupancyGraphDetailResult,
  OccupancyGraphResult,
  RoomTypeYoyResult,
} from '@/lib/services/reports/occupancy-p1.report';
import type { ThreeYearOccRow, ThreeYearRevRow } from '@/lib/services/reports/comparative-p2.report';
import type { LayoutColumn, LayoutFormat, LayoutRow, LayoutSection, ReportLayout } from '../layout';
import {
  MONTH_KEYS,
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
  type LayoutCtx,
} from './common';

function seriesTotals(days: OccupancyDay[], roomCapacity: number, bedCapacity: number | null) {
  const sold = sum(days, (d) => d.roomsSold);
  const pax = sum(days, (d) => d.pax);
  const roomRevenue = sum(days, (d) => d.roomRevenue);
  return {
    sold,
    pax,
    roomRevenue,
    totalRevenue: sum(days, (d) => d.totalRevenue),
    roomPct: safePct(sold, roomCapacity * days.length),
    bedPct: safePct(pax, bedCapacity == null ? null : bedCapacity * days.length),
    adr: safeDiv(roomRevenue, sold),
    revPar: safeDiv(roomRevenue, roomCapacity * days.length),
  };
}

/** Day rows: rooms, pax, arrivals, departures, comp/house, Room%, Bed%, revenue, ADR, RevPAR; totals row. */
export function buildMonthlyDailyLayout(slug: string, data: OccupancySeries, ctx: LayoutCtx): ReportLayout {
  const columns: LayoutColumn[] = [
    col(ctx, 'date', 'date', 1.1),
    col(ctx, 'roomsSold', 'int'),
    col(ctx, 'pax', 'int'),
    col(ctx, 'arrivals', 'int'),
    col(ctx, 'departures', 'int'),
    col(ctx, 'complimentary', 'int'),
    col(ctx, 'houseUse', 'int'),
    col(ctx, 'roomPct', 'pct'),
    col(ctx, 'bedPct', 'pct'),
    col(ctx, 'roomRevenue', 'money', 1.2),
    col(ctx, 'totalRevenue', 'money', 1.2),
    col(ctx, 'adr', 'money'),
    col(ctx, 'revPar', 'money'),
  ];
  const rows: LayoutRow[] = data.days.map((d) =>
    row([d.date, d.roomsSold, d.pax, d.arrivals, d.departures, d.complimentary, d.houseUse, d.roomPct, d.bedPct, d.roomRevenue, d.totalRevenue, d.adr, d.revPar]),
  );
  if (data.days.length > 0) {
    const t = seriesTotals(data.days, data.roomCapacity, data.bedCapacity);
    rows.push(
      totalRow(ctx, [
        t.sold,
        t.pax,
        sum(data.days, (d) => d.arrivals),
        sum(data.days, (d) => d.departures),
        sum(data.days, (d) => d.complimentary),
        sum(data.days, (d) => d.houseUse),
        t.roomPct,
        t.bedPct,
        t.roomRevenue,
        t.totalRevenue,
        t.adr,
        t.revPar,
      ]),
    );
  }
  return { slug, sections: [section('days', columns, rows)] };
}

/** Elektra annual occupancy: day (1–31) × month matrices for rooms, pax and Room%, plus a monthly summary. */
export function buildAnnualOccupancyLayout(slug: string, data: OccupancySeries, ctx: LayoutCtx): ReportLayout {
  const byDate = new Map(data.days.map((d) => [d.date, d]));
  const year = data.to.slice(0, 4);
  const monthCols: LayoutColumn[] = MONTH_KEYS.map((m) => ({ key: m, label: monthLabel(ctx, m), format: 'int' }));
  const dayNumbers = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
  const monthDays = (m: string) => data.days.filter((d) => d.date.slice(5, 7) === m);

  const matrix = (id: string, format: LayoutFormat, pick: (d: OccupancyDay) => number | null, total: (m: string) => number | null): LayoutSection => {
    const rows: LayoutRow[] = dayNumbers.map((dd) =>
      row([Number(dd), ...MONTH_KEYS.map((m) => {
        const d = byDate.get(`${year}-${m}-${dd}`);
        return d ? pick(d) : '';
      })]),
    );
    rows.push(totalRow(ctx, MONTH_KEYS.map((m) => (monthDays(m).length ? total(m) : ''))));
    return section(
      id,
      [col(ctx, 'day', 'int', 0.6), ...monthCols.map((c) => ({ ...c, format }))],
      rows,
      secTitle(ctx, id),
    );
  };

  const summaryColumns: LayoutColumn[] = [
    col(ctx, 'month', 'text', 1.1),
    col(ctx, 'roomNightsAvailable', 'int'),
    col(ctx, 'roomsSold', 'int'),
    col(ctx, 'pax', 'int'),
    col(ctx, 'roomPct', 'pct'),
    col(ctx, 'bedPct', 'pct'),
    col(ctx, 'roomRevenue', 'money', 1.2),
    col(ctx, 'adr', 'money'),
    col(ctx, 'revPar', 'money'),
  ];
  const summaryRows: LayoutRow[] = MONTH_KEYS.filter((m) => monthDays(m).length > 0).map((m) => {
    const days = monthDays(m);
    const t = seriesTotals(days, data.roomCapacity, data.bedCapacity);
    return row([monthLabel(ctx, `${year}-${m}`), data.roomCapacity * days.length, t.sold, t.pax, t.roomPct, t.bedPct, t.roomRevenue, t.adr, t.revPar]);
  });
  if (data.days.length > 0) {
    const t = seriesTotals(data.days, data.roomCapacity, data.bedCapacity);
    summaryRows.push(totalRow(ctx, [data.roomCapacity * data.days.length, t.sold, t.pax, t.roomPct, t.bedPct, t.roomRevenue, t.adr, t.revPar]));
  }

  return {
    slug,
    sections: [
      matrix('roomsMatrix', 'int', (d) => d.roomsSold, (m) => sum(monthDays(m), (d) => d.roomsSold)),
      matrix('paxMatrix', 'int', (d) => d.pax, (m) => sum(monthDays(m), (d) => d.pax)),
      matrix('roomPctMatrix', 'pct', (d) => d.roomPct, (m) => seriesTotals(monthDays(m), data.roomCapacity, data.bedCapacity).roomPct),
      section('monthly', summaryColumns, summaryRows, secTitle(ctx, 'monthly')),
    ],
  };
}

export function buildOccupancyGraphLayout(slug: string, data: OccupancyGraphResult, ctx: LayoutCtx): ReportLayout {
  const columns = [col(ctx, 'date', 'date'), col(ctx, 'roomsSold', 'int'), col(ctx, 'available', 'int'), col(ctx, 'roomPct', 'pct'), col(ctx, 'guestNights', 'int')];
  const rows: LayoutRow[] = data.rows.map((r) => row([r.date, r.roomsSold, r.roomsAvailable, r.occupancyPct, r.guestNights]));
  if (rows.length > 0) {
    const sold = sum(data.rows, (r) => r.roomsSold);
    const avail = sum(data.rows, (r) => r.roomsAvailable);
    rows.push(totalRow(ctx, [sold, avail, safePct(sold, avail), sum(data.rows, (r) => r.guestNights)]));
  }
  return { slug, sections: [section('days', columns, rows)] };
}

/** Grouped by date: one row per room type with sold / quota / occupancy. */
export function buildOccupancyGraphDetailLayout(slug: string, data: OccupancyGraphDetailResult, ctx: LayoutCtx): ReportLayout {
  const columns = [col(ctx, 'roomType', 'text', 1.6), col(ctx, 'sold', 'int'), col(ctx, 'quota', 'int'), col(ctx, 'roomPct', 'pct'), col(ctx, 'guestNights', 'int')];
  const rows: LayoutRow[] = [];
  let date = '';
  for (const r of data.rows) {
    if (r.date !== date) {
      date = r.date;
      rows.push(row([date, '', '', '', ''], 'group'));
    }
    rows.push(row([`${r.roomTypeCode} · ${r.roomTypeName}`, r.sold, r.quota, r.occupancyPct, r.guestNights]));
  }
  return { slug, sections: [section('detail', columns, rows)] };
}

export function buildForecastWoRevLayout(slug: string, data: ForecastWoRevResult, ctx: LayoutCtx): ReportLayout {
  const columns = [
    col(ctx, 'date', 'date'),
    col(ctx, 'arrivals', 'int'),
    col(ctx, 'departures', 'int'),
    col(ctx, 'stayovers', 'int'),
    col(ctx, 'sold', 'int'),
    col(ctx, 'available', 'int'),
    col(ctx, 'roomPct', 'pct'),
  ];
  const rows: LayoutRow[] = data.rows.map((r) => row([r.date, r.arrivals, r.departures, r.stayovers, r.sold, r.available, r.occupancyPct]));
  if (rows.length > 0) {
    const sold = sum(data.rows, (r) => r.sold);
    const avail = sum(data.rows, (r) => r.available);
    rows.push(totalRow(ctx, [sum(data.rows, (r) => r.arrivals), sum(data.rows, (r) => r.departures), sum(data.rows, (r) => r.stayovers), sold, avail, safePct(sold, sold + avail)]));
  }
  return { slug, sections: [section('days', columns, rows)] };
}

/** Forecast board: date rows × room type columns (rooms still available), with sold and quota totals. */
export function buildForecastBoardLayout(slug: string, data: ForecastBoardResult, ctx: LayoutCtx): ReportLayout {
  const available = pivot(data.rows, (r) => r.date, (r) => r.roomTypeCode, (r) => r.available);
  const sold = pivot(data.rows, (r) => r.date, (r) => r.roomTypeCode, (r) => r.sold);
  return {
    slug,
    sections: [
      matrixSection(ctx, 'available', secTitle(ctx, 'available'), col(ctx, 'date', 'date'), available, 'int'),
      matrixSection(ctx, 'sold', secTitle(ctx, 'sold'), col(ctx, 'date', 'date'), sold, 'int'),
    ],
  };
}

export function buildForecastLayout(slug: string, data: ForecastResult, ctx: LayoutCtx): ReportLayout {
  const columns = [
    col(ctx, 'date', 'date'),
    col(ctx, 'arrivals', 'int'),
    col(ctx, 'departures', 'int'),
    col(ctx, 'sold', 'int'),
    col(ctx, 'available', 'int'),
    col(ctx, 'roomPct', 'pct'),
    col(ctx, 'revenue', 'money', 1.2),
    col(ctx, 'adr', 'money'),
    col(ctx, 'revPar', 'money'),
  ];
  const rows: LayoutRow[] = data.rows.map((r) => row([r.date, r.arrivals, r.departures, r.sold, r.available, r.occupancyPct, r.revenue, r.adr, r.revPar]));
  if (rows.length > 0) {
    const sold = sum(data.rows, (r) => r.sold);
    const avail = sum(data.rows, (r) => r.available);
    const revenue = sum(data.rows, (r) => r.revenue);
    const capacity = sold + avail;
    rows.push(totalRow(ctx, [sum(data.rows, (r) => r.arrivals), sum(data.rows, (r) => r.departures), sold, avail, safePct(sold, capacity), revenue, safeDiv(revenue, sold), safeDiv(revenue, capacity)]));
  }
  return { slug, sections: [section('days', columns, rows)] };
}

export function buildForecastCompareLayout(slug: string, data: ForecastCompareResult, ctx: LayoutCtx): ReportLayout {
  const ly = colLabel(ctx, 'lastYear');
  const columns: LayoutColumn[] = [
    col(ctx, 'date', 'date'),
    col(ctx, 'sold', 'int'),
    col(ctx, 'roomPct', 'pct'),
    col(ctx, 'revenue', 'money'),
    { key: 'priorSold', label: `${colLabel(ctx, 'sold')} · ${ly}`, format: 'int' },
    { key: 'priorPct', label: `${colLabel(ctx, 'roomPct')} · ${ly}`, format: 'pct' },
    { key: 'priorRevenue', label: `${colLabel(ctx, 'revenue')} · ${ly}`, format: 'money' },
    col(ctx, 'change', 'int'),
  ];
  const rows: LayoutRow[] = data.rows.map((r) =>
    row([r.date, r.currentSold, r.currentOccPct, r.currentRevenue, r.priorSold, r.priorOccPct, r.priorRevenue, r.currentSold - r.priorSold]),
  );
  if (rows.length > 0) {
    const cur = sum(data.rows, (r) => r.currentSold);
    const prior = sum(data.rows, (r) => r.priorSold);
    rows.push(totalRow(ctx, [cur, '', sum(data.rows, (r) => r.currentRevenue), prior, '', sum(data.rows, (r) => r.priorRevenue), cur - prior]));
  }
  return { slug, sections: [section('days', columns, rows)] };
}

export function buildRoomTypeYoyLayout(slug: string, data: RoomTypeYoyResult, ctx: LayoutCtx): ReportLayout {
  const ly = colLabel(ctx, 'lastYear');
  const columns: LayoutColumn[] = [
    col(ctx, 'roomType', 'text', 1.6),
    col(ctx, 'roomNights', 'int'),
    col(ctx, 'roomPct', 'pct'),
    { key: 'priorNights', label: `${colLabel(ctx, 'roomNights')} · ${ly}`, format: 'int' },
    { key: 'priorPct', label: `${colLabel(ctx, 'roomPct')} · ${ly}`, format: 'pct' },
    col(ctx, 'change', 'int'),
  ];
  const rows: LayoutRow[] = data.rows.map((r) =>
    row([`${r.roomTypeCode} · ${r.roomTypeName}`, r.currentNights, r.currentOccPct, r.priorNights, r.priorOccPct, r.changeNights]),
  );
  if (rows.length > 0) {
    rows.push(totalRow(ctx, [sum(data.rows, (r) => r.currentNights), '', sum(data.rows, (r) => r.priorNights), '', sum(data.rows, (r) => r.changeNights)]));
  }
  return { slug, sections: [section('roomTypes', columns, rows)] };
}

/** Three-year comparison: month rows × year columns. */
export function buildThreeYearOccLayout(slug: string, data: ThreeYearOccRow[], ctx: LayoutCtx): ReportLayout {
  const first = data[0];
  const years = first ? [first.y2.year, first.y1.year, first.y0.year] : [];
  const columns: LayoutColumn[] = [col(ctx, 'month', 'text', 1.1)];
  for (const y of years) {
    columns.push({ key: `${y}_sold`, label: `${y} · ${colLabel(ctx, 'roomNights')}`, format: 'int' });
    columns.push({ key: `${y}_pct`, label: `${y} · ${colLabel(ctx, 'roomPct')}`, format: 'pct' });
  }
  const rows: LayoutRow[] = data.map((r) =>
    row([monthLabel(ctx, r.month), r.y2.roomsSold, r.y2.occPct, r.y1.roomsSold, r.y1.occPct, r.y0.roomsSold, r.y0.occPct]),
  );
  if (rows.length > 0) {
    rows.push(totalRow(ctx, [sum(data, (r) => r.y2.roomsSold), '', sum(data, (r) => r.y1.roomsSold), '', sum(data, (r) => r.y0.roomsSold), '']));
  }
  return { slug, sections: [section('months', columns, rows)] };
}

export function buildThreeYearRevLayout(slug: string, data: ThreeYearRevRow[], ctx: LayoutCtx): ReportLayout {
  const first = data[0];
  const years = first ? [first.y2.year, first.y1.year, first.y0.year] : [];
  const columns: LayoutColumn[] = [col(ctx, 'month', 'text', 1.1), ...years.map((y) => ({ key: String(y), label: String(y), format: 'money' as const }))];
  const rows: LayoutRow[] = data.map((r) => row([monthLabel(ctx, r.month), r.y2.revenue, r.y1.revenue, r.y0.revenue]));
  if (rows.length > 0) rows.push(totalRow(ctx, [sum(data, (r) => r.y2.revenue), sum(data, (r) => r.y1.revenue), sum(data, (r) => r.y0.revenue)]));
  return { slug, sections: [section('months', columns, rows)] };
}
