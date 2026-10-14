import type { GuestLedgerRow, InHouseResult, MainCurrentResult } from '@/lib/services/reports/guest-ledger.report';
import type { PoliceListResult } from '@/lib/services/reports/police-list.report';
import type { LayoutColumn, LayoutRow, LayoutSection, ReportLayout } from '../layout';
import { col, colLabel, row, section, secTitle, sum, valueLabel, type LayoutCtx } from './common';

function ledgerColumns(ctx: LayoutCtx, withRate: boolean): LayoutColumn[] {
  return [
    col(ctx, 'room', 'text', 0.6),
    col(ctx, 'guest', 'text', 2.2),
    col(ctx, 'roomType', 'text', 0.7),
    col(ctx, 'arrival', 'date'),
    col(ctx, 'departure', 'date'),
    col(ctx, 'nights', 'int', 0.6),
    col(ctx, 'adults', 'int', 0.6),
    col(ctx, 'children', 'int', 0.6),
    ...(withRate ? [col(ctx, 'rate', 'money')] : []),
    col(ctx, 'agency', 'text', 1.4),
    col(ctx, 'balance', 'money'),
  ];
}

function ledgerRows(ctx: LayoutCtx, items: GuestLedgerRow[], withRate: boolean): LayoutRow[] {
  const rows: LayoutRow[] = items.map((r) =>
    row([
      r.roomNumber ?? '',
      r.vipType ? `${r.guestName} (${r.vipType})` : r.guestName,
      r.roomType,
      r.arrival,
      r.departure,
      r.nights,
      r.adults,
      r.children,
      ...(withRate ? [r.rate] : []),
      r.agencyName ?? '',
      r.balance,
    ]),
  );
  if (items.length > 0) {
    rows.push(
      row(
        [
          colLabel(ctx, 'total'),
          `${items.length}`,
          '',
          '',
          '',
          sum(items, (r) => r.nights),
          sum(items, (r) => r.adults),
          sum(items, (r) => r.children),
          ...(withRate ? [''] : []),
          '',
          sum(items, (r) => r.balance),
        ],
        'total',
      ),
    );
  }
  return rows;
}

export function buildPoliceListLayout(slug: string, data: PoliceListResult, ctx: LayoutCtx): ReportLayout {
  const columns = [
    col(ctx, 'room', 'text', 0.7),
    col(ctx, 'firstName', 'text', 1.3),
    col(ctx, 'surname', 'text', 1.4),
    col(ctx, 'nationality', 'text', 0.8),
    col(ctx, 'idNo', 'text', 1.3),
    col(ctx, 'sex', 'text', 0.8),
    col(ctx, 'birthDate', 'date', 1),
    col(ctx, 'birthPlace', 'text', 1.4),
  ];
  const rows = data.rows.map((r) =>
    row([
      r.roomNumber,
      r.firstName,
      r.surname,
      r.nationality,
      r.idNo,
      valueLabel(ctx, 'sex', r.sex),
      r.birthDate,
      r.birthPlace,
    ]),
  );
  return { slug, sections: [section('policeList', columns, rows)] };
}

export function buildInHouseLayout(slug: string, data: InHouseResult, ctx: LayoutCtx): ReportLayout {
  return { slug, sections: [section('inHouse', ledgerColumns(ctx, true), ledgerRows(ctx, data.rows, true))] };
}

/** Main current: in-house ledger, today's arrivals and today's departures. */
export function buildMainCurrentLayout(slug: string, data: MainCurrentResult, ctx: LayoutCtx): ReportLayout {
  const sections: LayoutSection[] = [
    section('inHouse', ledgerColumns(ctx, true), ledgerRows(ctx, data.inHouse, true), secTitle(ctx, 'inHouse')),
    section('arrivals', ledgerColumns(ctx, false), ledgerRows(ctx, data.arrivals, false), secTitle(ctx, 'arrivals')),
    section('departures', ledgerColumns(ctx, false), ledgerRows(ctx, data.departures, false), secTitle(ctx, 'departures')),
  ];
  return { slug, sections };
}
