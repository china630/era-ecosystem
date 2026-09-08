import { parseHotelNoon } from '@/lib/hotel-calendar';
import { nextFreeShareBedIndex } from '@/lib/services/share-assignment.service';
import { assignSharePaintLanes } from '@/components/room-plan/share-lanes';
import {
  PLAN_BAR_COLORS,
  PLAN_BAR_OCCUPANCY_STROKE,
  isPlanVisibleRoom,
  resolvePlanBarDayState,
  resolvePlanBarOccupancyKind,
  themeForDayState,
} from '@/components/room-plan/plan-bar-theme';
import { barSvgPath, CHEVRON_PX, computePlacedBars, parseCalendarDate } from '@/components/room-plan/shapes';

/**
 * End-to-end unit smoke for the EW room-plan wave (seed 105 chain + geometry + theme).
 * Complements UAT §9 / §30 without requiring a running Next server.
 */
describe('room-plan EW wave smoke', () => {
  const today = '2026-06-01';

  it('105 share chain: bed assign + paint lanes never overlay A with C', () => {
    const a = {
      id: 'a',
      checkInDate: parseHotelNoon('2026-06-01'),
      checkOutDate: parseHotelNoon('2026-06-11'),
      shareBedIndex: 1 as number | null,
    };
    const b = {
      id: 'b',
      checkInDate: parseHotelNoon('2026-06-01'),
      checkOutDate: parseHotelNoon('2026-06-06'),
      shareBedIndex: 2 as number | null,
    };
    const cBed = nextFreeShareBedIndex({
      overlapping: [a, b],
      checkIn: parseHotelNoon('2026-06-07'),
      checkOut: parseHotelNoon('2026-06-13'),
      maxBed: 2,
    });
    expect(cBed).toBe(2);

    const lanes = assignSharePaintLanes(
      [
        {
          id: 'a',
          checkInDate: '2026-06-01',
          checkOutDate: '2026-06-11',
          shareEligible: true,
          shareGender: 'M',
          adults: 1,
          shareBedIndex: 1,
        },
        {
          id: 'b',
          checkInDate: '2026-06-01',
          checkOutDate: '2026-06-06',
          shareEligible: true,
          shareGender: 'M',
          adults: 1,
          shareBedIndex: 2,
        },
        {
          id: 'c',
          checkInDate: '2026-06-07',
          checkOutDate: '2026-06-13',
          shareEligible: true,
          shareGender: 'M',
          adults: 1,
          shareBedIndex: cBed,
        },
      ],
      2,
    );
    expect(lanes.get('a')).toBe(0);
    expect(lanes.get('c')).toBe(1);
    expect(lanes.get('a')).not.toBe(lanes.get('c'));
  });

  it('day-state palette: arrival lime / in-house green / departure pink / checkout gold / option dashed', () => {
    expect(
      resolvePlanBarDayState(
        {
          id: '1',
          status: 'CONFIRMED',
          checkInDate: today,
          checkOutDate: '2026-06-05',
        },
        [],
        today,
      ),
    ).toBe('expectedArrival');
    expect(themeForDayState('expectedArrival').text).toBe('#37474F');
    expect(themeForDayState('expectedArrival').fill).toBe(PLAN_BAR_COLORS.expectedArrival.fill);

    expect(
      resolvePlanBarDayState(
        {
          id: '2',
          status: 'IN_HOUSE',
          checkInDate: '2026-05-28',
          checkOutDate: '2026-06-10',
        },
        [],
        today,
      ),
    ).toBe('inHouse');
    expect(themeForDayState('inHouse').text).toBe('#FFFFFF');

    expect(
      resolvePlanBarDayState(
        {
          id: '3',
          status: 'IN_HOUSE',
          checkInDate: '2026-05-28',
          checkOutDate: today,
        },
        [],
        today,
      ),
    ).toBe('expectedDeparture');

    expect(
      resolvePlanBarDayState(
        { id: '4', status: 'CHECKED_OUT', checkInDate: '2026-05-20', checkOutDate: '2026-05-25' },
        [],
        today,
      ),
    ).toBe('checkout');

    const opt = themeForDayState(
      resolvePlanBarDayState(
        { id: '5', status: 'OPTION', checkInDate: '2026-06-03', checkOutDate: '2026-06-06' },
        [],
        today,
      ),
    );
    expect(opt.dashed).toBe(true);
  });

  it('blunt chevron depth is fixed CHEVRON_PX on long bars', () => {
    const wide = barSvgPath({ leftConcave: true, rightStyle: 'arrow' }, 400, 26);
    expect(wide).toContain(`L ${400 - CHEVRON_PX} 26`);
    expect(wide).toContain(`L ${CHEVRON_PX} 13`);
    const from = parseCalendarDate('2026-06-01');
    const placed = computePlacedBars(from, 14, [
      {
        id: 'long',
        roomId: 'r1',
        checkInDate: '2026-06-01',
        checkOutDate: '2026-06-12',
        status: 'CONFIRMED',
        guest: { fullName: 'Long Stay' },
        roomType: { code: 'STD' },
      },
    ]);
    expect(placed[0]!.shape.leftConcave).toBe(true);
    expect(placed[0]!.shape.rightStyle).toBe('arrow');
  });

  it('occupancy stroke: exclusive vs EW 0=male share vs female share', () => {
    expect(
      resolvePlanBarOccupancyKind({
        id: 'ex',
        status: 'IN_HOUSE',
        checkInDate: today,
        checkOutDate: '2026-06-05',
        adults: 2,
      }),
    ).toBe('exclusive');
    expect(
      resolvePlanBarOccupancyKind({
        id: 'm',
        status: 'IN_HOUSE',
        checkInDate: today,
        checkOutDate: '2026-06-05',
        shareEligible: true,
        shareGender: '0',
        adults: 1,
      }),
    ).toBe('shareM');
    expect(
      resolvePlanBarOccupancyKind({
        id: 'f',
        status: 'IN_HOUSE',
        checkInDate: today,
        checkOutDate: '2026-06-05',
        shareEligible: true,
        shareGender: 'F',
        adults: 1,
      }),
    ).toBe('shareF');
    expect(PLAN_BAR_OCCUPANCY_STROKE.shareM).toBe('#1565C0');
    expect(PLAN_BAR_OCCUPANCY_STROKE.shareF).toBe('#AD1457');
  });

  it('hides OOO/OOS/repair doors from the plan', () => {
    expect(isPlanVisibleRoom({ status: 'DIRTY', inventoryStatus: 'IN_SERVICE' })).toBe(true);
    expect(isPlanVisibleRoom({ status: 'OOO' })).toBe(false);
    expect(isPlanVisibleRoom({ status: 'AVAILABLE', inventoryStatus: 'OOS' })).toBe(false);
    expect(isPlanVisibleRoom({ status: 'MAINTENANCE' })).toBe(false);
  });
});
