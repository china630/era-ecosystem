import {
  barLayoutOffset,
  barSvgPath,
  calendarDateKey,
  CHEVRON_PX,
  computePlacedBars,
  hasSameDayTurnoverEnd,
  hasSameDayTurnoverStart,
  parseCalendarDate,
} from '@/components/room-plan/shapes';
import type { RoomPlanReservationBar } from '@/components/room-plan/types';

function bar(
  id: string,
  checkIn: string,
  checkOut: string,
): RoomPlanReservationBar {
  return {
    id,
    roomId: 'r1',
    checkInDate: checkIn,
    checkOutDate: checkOut,
    status: 'CONFIRMED',
    guest: { fullName: 'Test' },
    roomType: { code: 'STD' },
  };
}

describe('room plan bar shapes', () => {
  it('uses blunt px chevron tip on a normal departure edge', () => {
    const width = 200;
    const path = barSvgPath({ leftConcave: true, rightStyle: 'arrow' }, width, 26);
    expect(path).toContain(`L ${width} 13`);
    expect(path).toContain(`L ${width - CHEVRON_PX} 26`);
    expect(path).toContain(`L ${CHEVRON_PX} 13 L 0 0`);
  });

  it('uses the same chevron depth on nose and butt', () => {
    const width = 160;
    const path = barSvgPath({ leftConcave: true, rightStyle: 'arrow' }, width, 26);
    expect(path).toContain(`L ${width - CHEVRON_PX} 26`);
    expect(path).toContain(`L ${CHEVRON_PX} 13`);
  });

  it('uses a flat edge only when the stay is clipped by the window (continues)', () => {
    const path = barSvgPath({ leftConcave: false, rightStyle: 'flat' }, 100, 26);
    expect(path).toBe('M 0 0 L 100 0 L 100 26 L 0 26 L 0 0 Z');
    expect(path).not.toContain('L 100 13');
  });

  it('marks leftConcave for any in-window multi-night start (EW butt)', () => {
    const from = parseCalendarDate('2026-06-10');
    const a = bar('a', '2026-06-10', '2026-06-14');
    const placed = computePlacedBars(from, 14, [a]);
    expect(placed[0]!.shape.leftConcave).toBe(true);
    expect(placed[0]!.shape.rightStyle).toBe('arrow');
  });

  it('detects turnover when prior checkout day equals check-in', () => {
    const a = bar('a', '2026-06-10', '2026-06-12');
    const b = bar('b', '2026-06-12', '2026-06-14');
    expect(hasSameDayTurnoverStart(b, [a, b])).toBe(true);
    expect(hasSameDayTurnoverEnd(a, [a, b])).toBe(true);
  });

  it('skips turnover start when bar is clipped at plan start (check-in off-screen)', () => {
    const prior = bar('a', '2026-06-02', '2026-06-05');
    const anna = bar('b', '2026-06-05', '2026-06-07');
    expect(hasSameDayTurnoverStart(anna, [prior, anna])).toBe(true);
    expect(hasSameDayTurnoverStart(anna, [prior, anna], { clippedAtStart: true })).toBe(false);
    const from = parseCalendarDate('2026-06-06');
    const placed = computePlacedBars(from, 14, [prior, anna]);
    const row = placed.find((p) => p.reservation.id === 'b')!;
    expect(row.clippedAtStart).toBe(true);
    expect(row.turnoverStart).toBe(false);
    expect(row.shape.leftConcave).toBe(false);
  });

  it('does not mark turnover when stays overlap on the room', () => {
    const a = bar('a', '2026-06-05', '2026-06-10');
    const b = bar('b', '2026-06-07', '2026-06-12');
    expect(hasSameDayTurnoverStart(b, [a, b])).toBe(false);
  });

  it('uses Baku calendar for UTC noon storage', () => {
    expect(calendarDateKey('2026-06-06T08:00:00.000Z')).toBe('2026-06-06');
    expect(calendarDateKey('2026-06-06')).toBe('2026-06-06');
  });

  it('places turnover bars on shared checkout column', () => {
    const from = parseCalendarDate('2026-06-10');
    const a = bar('a', '2026-06-10', '2026-06-12');
    const b = bar('b', '2026-06-12', '2026-06-14');
    const placed = computePlacedBars(from, 14, [a, b]);
    const outA = placed.find((p) => p.reservation.id === 'a')!;
    const inB = placed.find((p) => p.reservation.id === 'b')!;
    expect(outA.turnoverEnd).toBe(true);
    expect(inB.turnoverStart).toBe(true);
    expect(outA.shape.rightStyle).toBe('arrow');
    expect(inB.shape.leftConcave).toBe(true);
    expect(outA.colStart + outA.span).toBe(inB.colStart);
  });

  it('203 chain: turnover bars end at checkout noon, not next day column', () => {
    const from = parseCalendarDate('2026-06-01');
    const days = 14;
    const dmitry = bar('d', '2026-06-02', '2026-06-05');
    const anna = bar('a', '2026-06-05', '2026-06-07');
    const hans = bar('h', '2026-06-07', '2026-06-09');
    const placed = computePlacedBars(from, days, [dmitry, anna, hans]);
    const pAnna = placed.find((p) => p.reservation.id === 'a')!;
    const pHans = placed.find((p) => p.reservation.id === 'h')!;
    expect(pAnna.turnoverStart).toBe(true);
    expect(pHans.turnoverStart).toBe(true);

    const colUnit = 100 / days;
    const annaLayout = barLayoutOffset(days, pAnna);
    const annaStart = annaLayout.leftPct / colUnit;
    const annaEnd = (annaLayout.leftPct + annaLayout.widthPct) / colUnit;
    expect(annaStart).toBeCloseTo(4.5, 5);
    expect(annaEnd).toBeCloseTo(6.5, 5);

    const hansLayout = barLayoutOffset(days, pHans);
    const hansStart = hansLayout.leftPct / colUnit;
    const hansEnd = (hansLayout.leftPct + hansLayout.widthPct) / colUnit;
    expect(hansStart).toBeCloseTo(6.5, 5);
    expect(hansEnd).toBeCloseTo(8.5, 5);
  });
});
