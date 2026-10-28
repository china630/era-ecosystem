import { describe, expect, it } from '@jest/globals';
import {
  buildComputedLines,
  computeCommissionAmount,
  forecastCommissionAmount,
  isCommissionRevenueBase,
  sumRevenueBaseForPeriod,
} from '@/lib/services/agency-commission.math';

describe('agency commission math', () => {
  it('GROSS computes percent of revenue base', () => {
    expect(computeCommissionAmount(1000, 10, 'GROSS')).toEqual({
      amount: 100,
      status: 'ACCRUED',
    });
  });

  it('NET skips payable amount', () => {
    expect(computeCommissionAmount(1000, 10, 'NET')).toEqual({
      amount: 0,
      status: 'SKIPPED_NET',
    });
  });

  it('zero percent yields zero accrued', () => {
    expect(computeCommissionAmount(500, 0, 'GROSS').amount).toBe(0);
  });

  it('includes ROOM/PKG/RATE_ADJ only', () => {
    expect(isCommissionRevenueBase({ systemRole: 'ROOM', isRoomRevenueCode: true })).toBe(true);
    expect(isCommissionRevenueBase({ systemRole: 'CITY_TAX', isRoomRevenueCode: true })).toBe(false);
    expect(isCommissionRevenueBase({ systemRole: 'MINIBAR', isRoomRevenueCode: false })).toBe(false);
  });

  it('sums revenue only inside period', () => {
    const from = new Date('2026-10-01T00:00:00.000Z');
    const to = new Date('2026-10-03T23:59:59.999Z');
    const sum = sumRevenueBaseForPeriod(
      [
        {
          businessDate: new Date('2026-10-02T00:00:00.000Z'),
          amount: 100,
          qty: 1,
          systemRole: 'ROOM',
          isRoomRevenueCode: true,
        },
        {
          businessDate: new Date('2026-09-30T00:00:00.000Z'),
          amount: 50,
          qty: 1,
          systemRole: 'ROOM',
          isRoomRevenueCode: true,
        },
      ],
      from,
      to,
    );
    expect(sum).toBe(100);
  });

  it('builds one line per commercial slice (mid-stay split)', () => {
    const lines = buildComputedLines(
      [
        {
          periodKey: 'p1',
          commercialPeriodId: 'p1',
          agencyId: 'ag1',
          fromDate: new Date('2026-10-01T00:00:00.000Z'),
          toDate: new Date('2026-10-03T00:00:00.000Z'),
          commissionBasis: 'GROSS',
          commissionPercent: 10,
        },
        {
          periodKey: 'p2',
          commercialPeriodId: 'p2',
          agencyId: 'ag1',
          fromDate: new Date('2026-10-03T00:00:00.000Z'),
          toDate: new Date('2026-10-05T00:00:00.000Z'),
          commissionBasis: 'GROSS',
          commissionPercent: 10,
        },
      ],
      [
        {
          businessDate: new Date('2026-10-02T00:00:00.000Z'),
          amount: 200,
          qty: 1,
          systemRole: 'ROOM',
          isRoomRevenueCode: true,
        },
        {
          businessDate: new Date('2026-10-04T00:00:00.000Z'),
          amount: 300,
          qty: 1,
          systemRole: 'ROOM',
          isRoomRevenueCode: true,
        },
      ],
    );
    expect(lines).toHaveLength(2);
    expect(lines[0]!.amount).toBe(20);
    expect(lines[1]!.amount).toBe(30);
  });

  it('skips stay with no agency percent and no revenue', () => {
    const lines = buildComputedLines(
      [
        {
          periodKey: 'default',
          commercialPeriodId: null,
          agencyId: 'ag1',
          fromDate: new Date('2026-10-01T00:00:00.000Z'),
          toDate: new Date('2026-10-02T00:00:00.000Z'),
          commissionBasis: 'GROSS',
          commissionPercent: 0,
        },
      ],
      [],
    );
    expect(lines).toHaveLength(0);
  });

  it('forecast is zero on NET', () => {
    expect(forecastCommissionAmount(3, 100, 10, 'NET')).toBe(0);
    expect(forecastCommissionAmount(3, 100, 10, 'GROSS')).toBe(30);
  });
});
