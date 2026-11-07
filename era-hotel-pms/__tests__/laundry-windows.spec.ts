import {
  laundryDueAt,
  laundryIntakeBlockReason,
} from '@/lib/services/laundry-windows';

describe('laundry windows Asia/Baku', () => {
  it('ANY mode accepts weekday wash at any hour', () => {
    const weekdayNoonUtc = new Date('2026-08-24T08:00:00.000Z');
    expect(
      laundryIntakeBlockReason({
        now: weekdayNoonUtc,
        hasWash: true,
        hasIron: false,
        express: false,
        dayType: 'working',
        policy: { intakeMode: 'ANY' },
      }),
    ).toBeNull();
    const late = new Date('2026-08-24T14:00:00.000Z');
    expect(
      laundryIntakeBlockReason({
        now: late,
        hasWash: true,
        hasIron: false,
        express: false,
        dayType: 'working',
        policy: { intakeMode: 'ANY' },
      }),
    ).toBeNull();
  });

  it('default policy is WINDOW 09–17 (prior Nafta hours)', () => {
    const inside = new Date('2026-08-24T08:00:00.000Z'); // 12:00 Baku
    expect(
      laundryIntakeBlockReason({
        now: inside,
        hasWash: true,
        hasIron: false,
        express: false,
        dayType: 'working',
      }),
    ).toBeNull();
    const afterWash = new Date('2026-08-24T14:00:00.000Z'); // 18:00 Baku
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

  it('WINDOW mode blocks outside the hour range', () => {
    const afterWash = new Date('2026-08-24T14:00:00.000Z');
    expect(
      laundryIntakeBlockReason({
        now: afterWash,
        hasWash: true,
        hasIron: false,
        express: false,
        dayType: 'working',
        policy: { intakeMode: 'WINDOW', intakeStartHour: 9, intakeEndHour: 17 },
      }),
    ).toMatch(/09:00/i);
  });

  it('due same day if before cutoff, else next day; NONE returns null', () => {
    const beforeTen = new Date('2026-08-24T05:00:00.000Z');
    expect(
      laundryDueAt(beforeTen, {
        dueMode: 'BY_HOUR',
        dueCutoffHour: 10,
        dueAtHour: 17,
        closedDays: 'EXCEPT_SUNDAY_AND_CALENDAR',
      })?.toISOString(),
    ).toBe('2026-08-24T13:00:00.000Z');
    const afterTen = new Date('2026-08-24T08:00:00.000Z');
    expect(
      laundryDueAt(afterTen, {
        dueMode: 'BY_HOUR',
        dueCutoffHour: 10,
        dueAtHour: 17,
        closedDays: 'EXCEPT_SUNDAY_AND_CALENDAR',
      })?.toISOString(),
    ).toBe('2026-08-25T13:00:00.000Z');
    expect(laundryDueAt(afterTen, { dueMode: 'NONE' })).toBeNull();
  });

  it('blocks Sunday and holiday when closed-days mode includes them', () => {
    const sunday = new Date('2026-08-23T08:00:00.000Z');
    expect(
      laundryIntakeBlockReason({
        now: sunday,
        hasWash: true,
        hasIron: false,
        express: false,
        policy: { closedDays: 'EXCEPT_SUNDAY_AND_CALENDAR' },
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
        policy: { closedDays: 'EXCEPT_SUNDAY_AND_CALENDAR' },
      }),
    ).toMatch(/holiday/i);
    expect(
      laundryIntakeBlockReason({
        now: weekdayMorning,
        hasWash: true,
        hasIron: false,
        express: false,
        dayType: 'working',
        policy: { closedDays: 'ALL', intakeMode: 'ANY' },
      }),
    ).toBeNull();
  });
});
