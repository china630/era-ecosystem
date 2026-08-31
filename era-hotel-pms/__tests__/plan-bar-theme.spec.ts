import {
  hasOverlappingShareRoommate,
  PLAN_BAR_COLORS,
  resolveHkSquareKind,
  resolvePlanBarDayState,
  themeForDayState,
  type PlanBarInput,
} from '@/components/room-plan/plan-bar-theme';

function bar(partial: Partial<PlanBarInput> & Pick<PlanBarInput, 'id' | 'status'>): PlanBarInput {
  return {
    checkInDate: '2026-06-10',
    checkOutDate: '2026-06-15',
    roomId: 'r1',
    shareEligible: false,
    adults: 1,
    ...partial,
  };
}

describe('plan-bar-theme', () => {
  const today = '2026-06-10';

  it('maps OPTION to dashed grey (not EW green)', () => {
    const state = resolvePlanBarDayState(bar({ id: 'o', status: 'OPTION' }), [], today);
    expect(state).toBe('option');
    const theme = themeForDayState(state);
    expect(theme.dashed).toBe(true);
    expect(theme.text).toBe('#37474F');
    expect(theme.fill).toBe(PLAN_BAR_COLORS.option.fill);
  });

  it('CONFIRMED today → expectedArrival (dark text on yellow)', () => {
    const state = resolvePlanBarDayState(
      bar({ id: 'a', status: 'CONFIRMED', checkInDate: today, checkOutDate: '2026-06-14' }),
      [],
      today,
    );
    expect(state).toBe('expectedArrival');
    expect(themeForDayState(state).text).toBe('#37474F');
    expect(themeForDayState(state).fill).toBe('#FDD835');
  });

  it('CONFIRMED overdue (ci before today) → still expectedArrival', () => {
    const state = resolvePlanBarDayState(
      bar({ id: 'a', status: 'CONFIRMED', checkInDate: '2026-06-08', checkOutDate: '2026-06-14' }),
      [],
      today,
    );
    expect(state).toBe('expectedArrival');
  });

  it('CONFIRMED future → reservation (white text)', () => {
    const state = resolvePlanBarDayState(
      bar({ id: 'a', status: 'CONFIRMED', checkInDate: '2026-06-12', checkOutDate: '2026-06-16' }),
      [],
      today,
    );
    expect(state).toBe('reservation');
    expect(themeForDayState(state).text).toBe('#FFFFFF');
  });

  it('IN_HOUSE departing today → expectedDeparture (pink)', () => {
    const state = resolvePlanBarDayState(
      bar({ id: 'a', status: 'IN_HOUSE', checkInDate: '2026-06-05', checkOutDate: today }),
      [],
      today,
    );
    expect(state).toBe('expectedDeparture');
    expect(themeForDayState(state).fill).toBe('#F06292');
    expect(themeForDayState(state).text).toBe('#FFFFFF');
  });

  it('IN_HOUSE staying → inHouse (forest green)', () => {
    const state = resolvePlanBarDayState(
      bar({ id: 'a', status: 'IN_HOUSE', checkInDate: '2026-06-05', checkOutDate: '2026-06-20' }),
      [],
      today,
    );
    expect(state).toBe('inHouse');
    expect(themeForDayState(state).fill).toBe('#2E7D32');
  });

  it('CHECKED_OUT → checkout amber', () => {
    const state = resolvePlanBarDayState(bar({ id: 'a', status: 'CHECKED_OUT' }), [], today);
    expect(state).toBe('checkout');
    expect(themeForDayState(state).fill).toBe('#FFA000');
  });

  it('single share in empty pool is NOT multiple', () => {
    const a = bar({
      id: 'a',
      status: 'IN_HOUSE',
      shareEligible: true,
      shareGender: 'M',
      adults: 1,
    });
    expect(hasOverlappingShareRoommate(a, [a])).toBe(false);
    expect(resolvePlanBarDayState(a, [a], today)).toBe('inHouse');
  });

  it('overlapping share roommates → multiple cyan', () => {
    const a = bar({
      id: 'a',
      status: 'IN_HOUSE',
      checkInDate: '2026-06-05',
      checkOutDate: '2026-06-15',
      shareEligible: true,
      shareGender: 'M',
      adults: 1,
    });
    const b = bar({
      id: 'b',
      status: 'CONFIRMED',
      checkInDate: '2026-06-08',
      checkOutDate: '2026-06-18',
      shareEligible: true,
      shareGender: 'M',
      adults: 1,
    });
    expect(hasOverlappingShareRoommate(a, [a, b])).toBe(true);
    expect(resolvePlanBarDayState(a, [a, b], today)).toBe('multiple');
    expect(themeForDayState('multiple').fill).toBe('#00BCD4');
  });

  it('resolves HK square kinds from room status', () => {
    expect(resolveHkSquareKind({ status: 'CLEAN' })).toBe('clean');
    expect(resolveHkSquareKind({ status: 'INSPECTED' })).toBe('clean');
    expect(resolveHkSquareKind({ status: 'DIRTY' })).toBe('dirty');
    expect(resolveHkSquareKind({ status: 'AVAILABLE', hkCondition: 'PICKUP' })).toBe('dirty');
    expect(resolveHkSquareKind({ status: 'MAINTENANCE' })).toBe('maintenance');
    expect(resolveHkSquareKind({ status: 'OOO' })).toBe('closed');
    expect(resolveHkSquareKind({ status: 'OOS' })).toBe('closed');
  });
});
