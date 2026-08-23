import { laundryDueAt, laundryIntakeBlockReason } from '@/lib/services/laundry-windows';

describe('laundry windows Asia/Baku', () => {
  it('accepts regular wash after 10:00 on a weekday', () => {
    const weekdayNoonUtc = new Date('2026-08-24T08:00:00.000Z');
    expect(
      laundryIntakeBlockReason({
        now: weekdayNoonUtc,
        hasWash: true,
        hasIron: false,
        express: false,
        dayType: 'working',
      }),
    ).toBeNull();
  });

  it('due same day 17:00 Baku if before 10:00, else next working day', () => {
    const beforeTen = new Date('2026-08-24T05:00:00.000Z');
    expect(laundryDueAt(beforeTen).toISOString()).toBe('2026-08-24T13:00:00.000Z');
    const afterTen = new Date('2026-08-24T08:00:00.000Z');
    expect(laundryDueAt(afterTen).toISOString()).toBe('2026-08-25T13:00:00.000Z');
  });

  it('blocks Sunday and holiday; wash after 17:00', () => {
    const sunday = new Date('2026-08-23T08:00:00.000Z');
    expect(
      laundryIntakeBlockReason({
        now: sunday,
        hasWash: true,
        hasIron: false,
        express: false,
      }),
    ).toBeTruthy();
    const weekdayMorning = new Date('2026-08-24T06:00:00.000Z');
    expect(
      laundryIntakeBlockReason({
        now: weekdayMorning,
        hasWash: true,
        hasIron: false,
        express: false,
        dayType: 'holiday',
      }),
    ).toMatch(/holiday/i);
    const afterWash = new Date('2026-08-24T14:00:00.000Z');
    expect(
      laundryIntakeBlockReason({
        now: afterWash,
        hasWash: true,
        hasIron: false,
        express: false,
        dayType: 'working',
      }),
    ).toMatch(/09:00/i);
  });
});
