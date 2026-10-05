import { bakuDayBounds } from '@era/satellite-kit/time';
import type { HotelCapacity, RevenueCodeInfo, StayRow } from '@/lib/services/reports/stay-ledger';

const capacity: HotelCapacity = { roomCapacity: 10, bedCapacity: null, physicalRooms: 10, ooo: 1, oos: 0 };
const stays: StayRow[] = [];
const payments: { createdAt: Date; amount: number; kind: string; paymentMethod: string }[] = [];

jest.mock('@/lib/prisma', () => ({
  prisma: { folioPayment: { findMany: jest.fn(async () => payments) } },
}));

jest.mock('@/lib/services/reports/stay-ledger', () => {
  const actual = jest.requireActual('@/lib/services/reports/stay-ledger');
  const codes = new Map<string, RevenueCodeInfo>([
    ['rc-room', { id: 'rc-room', code: 'RM', name: 'Room', departmentCode: 'ROOM', departmentName: 'Rooms', vatRate: 0.18, isRoom: true }],
  ]);
  return {
    ...actual,
    loadCapacity: jest.fn(async () => capacity),
    loadStays: jest.fn(async () => stays),
    loadRevenueCodes: jest.fn(async () => codes),
    loadChargeDays: jest.fn(async () => [{ day: '2026-10-04', revenueCodeId: 'rc-room', gross: 118 }]),
  };
});

import { buildFlashLayout } from '@/lib/reports/layouts/flash';
import { buildTrialBalanceLayout } from '@/lib/reports/layouts/financial';
import { buildMonthlyDailyLayout } from '@/lib/reports/layouts/occupancy';
import { formatLayoutCell, type ReportLayout } from '@/lib/reports/layout';
import { reportPdfT } from '@/lib/reports/pdf-i18n';
import { queryDailyManagement } from '@/lib/services/reports/flash.report';
import { indexStayDays } from '@/lib/services/reports/stay-ledger';
import type { TrialBalancePeriodResult } from '@/lib/services/reports/trial-balance-period.service';
import type { OccupancySeries } from '@/lib/services/reports/monthly-daily-analysis.report';

const ctx = (locale = 'en') => ({ t: reportPdfT(locale), locale, from: '2026-10-04', to: '2026-10-04' });

function at(ymd: string, hour = 12): Date {
  return new Date(bakuDayBounds(ymd).start.getTime() + hour * 3_600_000);
}

function metric(layout: ReportLayout, label: string) {
  const sec = layout.sections.find((s) => s.id === 'rooms');
  return sec?.rows.find((r) => r.cells[0] === label);
}

function labels(layout: ReportLayout): string[] {
  return layout.sections.flatMap((s) => [s.title ?? '', ...s.columns.map((c) => c.label), ...s.rows.map((r) => String(r.cells[0] ?? ''))]);
}

describe('flash layout (daily management)', () => {
  beforeEach(() => {
    capacity.roomCapacity = 10;
    capacity.bedCapacity = null;
    stays.length = 0;
    payments.length = 0;
    stays.push({
      id: 'r1',
      status: 'IN_HOUSE',
      roomId: 'room-1',
      roomCount: 1,
      checkIn: at('2026-10-03', 14),
      checkOut: at('2026-10-06', 12),
      inYmd: '2026-10-03',
      outYmd: '2026-10-06',
      adults: 2,
      children: 0,
      accomType: null,
      totalAmount: 300,
    });
    payments.push(
      { createdAt: at('2026-10-04'), amount: 100, kind: 'PAYMENT', paymentMethod: 'CASH' },
      { createdAt: at('2026-10-04'), amount: 20, kind: 'REFUND', paymentMethod: 'CASH' },
    );
  });

  it('prints Today, Tomorrow, Month and Year blocks', async () => {
    const layout = buildFlashLayout('daily-management', await queryDailyManagement('2026-10-04'), ctx());
    const rooms = layout.sections.find((s) => s.id === 'rooms');
    expect(rooms?.columns.map((c) => c.label)).toEqual(['Indicator', 'Today', 'Tomorrow', 'Month to date', 'Year to date']);
    expect(metric(layout, 'Rooms sold')?.cells.slice(1)).toEqual([1, 1, 2, 2]);
    expect(metric(layout, 'Room %')?.cells[1]).toBe(10);
    expect(metric(layout, 'Room revenue')?.cells[2]).toBeNull();

    const revenue = layout.sections.find((s) => s.id === 'revenue');
    expect(revenue?.columns.slice(1, 4).map((c) => c.label)).toEqual(['Today · Net', 'Today · VAT', 'Today · Total']);
    expect(revenue?.rows[0]?.cells.slice(1, 4)).toEqual([100, 18, 118]);

    const pay = layout.sections.find((s) => s.id === 'payments');
    expect(pay?.rows[0]?.cells.slice(0, 2)).toEqual(['Cash', 80]);
  });

  it('prints an em dash for Bed % without bed capacity and Room % with zero rooms', async () => {
    capacity.roomCapacity = 0;
    const layout = buildFlashLayout('daily-management', await queryDailyManagement('2026-10-04'), ctx());
    const bed = metric(layout, 'Bed %');
    const room = metric(layout, 'Room %');
    expect(bed?.cells[1]).toBeNull();
    expect(room?.cells[1]).toBeNull();
    expect(formatLayoutCell(bed?.cells[1] ?? null, bed?.format, 'en')).toBe('—');
    expect(formatLayoutCell(room?.cells[1] ?? null, room?.format, 'en')).toBe('—');
  });

  it('computes Bed % once bed capacity is set', async () => {
    capacity.bedCapacity = 20;
    const layout = buildFlashLayout('daily-management', await queryDailyManagement('2026-10-04'), ctx());
    expect(metric(layout, 'Bed %')?.cells[1]).toBe(10);
  });

  it.each(['en', 'az', 'ru'])('has translated labels in %s', async (locale) => {
    const layout = buildFlashLayout('daily-management', await queryDailyManagement('2026-10-04'), ctx(locale));
    expect(labels(layout).filter((l) => l.startsWith('reportsPdf.'))).toEqual([]);
  });
});

describe('stay day index', () => {
  it('counts a shared room once and keeps every guest', () => {
    const base = { status: 'IN_HOUSE', roomCount: 1, adults: 1, children: 0, accomType: null, totalAmount: 0 };
    const shared: StayRow[] = [
      { ...base, id: 'a', roomId: 'r1', checkIn: at('2026-10-01'), checkOut: at('2026-10-03'), inYmd: '2026-10-01', outYmd: '2026-10-03' },
      { ...base, id: 'b', roomId: 'r1', checkIn: at('2026-10-02'), checkOut: at('2026-10-04'), inYmd: '2026-10-02', outYmd: '2026-10-04' },
    ];
    const index = indexStayDays(shared, '2026-10-01', '2026-10-04');
    expect(index.get('2026-10-02')?.night).toMatchObject({ sold: 1, pax: 2 });
    expect(index.get('2026-10-03')?.night).toMatchObject({ sold: 1, pax: 1 });
    expect(index.get('2026-10-04')?.night.sold).toBe(0);
    expect(index.get('2026-10-02')?.arrivals.rooms).toBe(1);
    expect(index.get('2026-10-04')?.departures.rooms).toBe(1);
  });
});

describe('trial balance layout', () => {
  const data: TrialBalancePeriodResult = {
    from: '2026-10-04',
    to: '2026-10-04',
    openingBalance: 500,
    departments: [
      { code: 'ROOM', name: 'Rooms', net: 100, vat: 18, gross: 118, codes: [{ code: 'RM', name: 'Room', net: 100, vat: 18, gross: 118 }] },
    ],
    chargesNet: 100,
    chargesVat: 18,
    chargesGross: 118,
    payments: [{ method: 'CASH', amount: 80 }],
    paymentsTotal: 80,
    closingBalance: 538,
  };

  it('starts with balance brought forward and prints payments negative', () => {
    const rows = buildTrialBalanceLayout('trial-balance-period', data, ctx()).sections[0].rows;
    expect(rows[0]).toMatchObject({ kind: 'subtotal', cells: ['', 'Balance brought forward', '', '', 500] });
    expect(rows.find((r) => r.cells[1] === 'Cash')?.cells[4]).toBe(-80);
    expect(rows.find((r) => r.cells[1] === 'Payments total')?.cells[4]).toBe(-80);
    expect(rows[rows.length - 1]).toMatchObject({ kind: 'total', cells: ['', 'Closing balance', '', '', 538] });
  });
});

describe('monthly daily analysis layout', () => {
  it('keeps the em dash for Bed % in day rows and totals', () => {
    const series: OccupancySeries = {
      from: '2026-10-01',
      to: '2026-10-01',
      roomCapacity: 0,
      bedCapacity: null,
      days: [
        {
          date: '2026-10-01',
          roomsSold: 0,
          pax: 0,
          arrivals: 0,
          departures: 0,
          complimentary: 0,
          houseUse: 0,
          roomRevenue: 0,
          totalRevenue: 0,
          roomPct: null,
          bedPct: null,
          adr: null,
          revPar: null,
        },
      ],
    };
    const sec = buildMonthlyDailyLayout('monthly-daily-analysis', series, ctx()).sections[0];
    const bedIdx = sec.columns.findIndex((c) => c.key === 'bedPct');
    const roomIdx = sec.columns.findIndex((c) => c.key === 'roomPct');
    for (const r of sec.rows) {
      expect(formatLayoutCell(r.cells[bedIdx], 'pct', 'en')).toBe('—');
      expect(formatLayoutCell(r.cells[roomIdx], 'pct', 'en')).toBe('—');
    }
  });
});
