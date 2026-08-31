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
    expect(theme.text).toBe('#34495E');
    expect(theme.fill).toBe(PLAN_BAR_COLORS.option.fill);
  });

  it('CONFIRMED today → expectedArrival (light text)', () => {
    const state = resolvePlanBarDayState(
      bar({ id: 'a', status: 'CONFIRMED', checkInDate: today, checkOutDate: '2026-06-14' }),
      [],
      today,
    );
    expect(state).toBe('expectedArrival');
    expect(themeForDayState(state).text).toBe('#34495E');
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

  it('IN_HOUSE departing today → expectedDeparture', () => {
    const state = resolvePlanBarDayState(
      bar({ id: 'a', status: 'IN_HOUSE', checkInDate: '2026-06-05', checkOutDate: today }),
      [],
      today,
    );
    expect(state).toBe('expectedDeparture');
    expect(themeForDayState(state).text).toBe('#34495E');
  });

  it('IN_HOUSE staying → inHouse', () => {
    const state = resolvePlanBarDayState(
      bar({ id: 'a', status: 'IN_HOUSE', checkInDate: '2026-06-05', checkOutDate: '2026-06-20' }),
      [],
      today,
    );
    expect(state).toBe('inHouse');
  });

  it('CHECKED_OUT → checkout gold', () => {
    const state = resolvePlanBarDayState(bar({ id: 'a', status: 'CHECKED_OUT' }), [], today);
    expect(state).toBe('checkout');
    expect(themeForDayState(state).fill).toBe('#FFC107');
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
    expect(themeForDayState('multiple').fill).toBe('#26C6DA');
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
