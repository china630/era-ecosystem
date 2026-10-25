import { bakuCivilUtcDate } from '@era/satellite-kit/time';
import { hotelDateKey } from '@/lib/hotel-calendar';
import { forwardDoorGaps, planDoorMove, type DoorSlice } from '@/lib/services/stay-door-move';
import { dedupPair } from '@/lib/services/guest-merge.service';

function slice(partial: Partial<DoorSlice> & Pick<DoorSlice, 'id' | 'fromDate' | 'toDate'>): DoorSlice {
  return {
    roomId: 'old',
    roomTypeId: 'type',
    ratePlanId: 'rate',
    ...partial,
  };
}

const day = (ymd: string) => bakuCivilUtcDate(ymd);

describe('planDoorMove', () => {
  it('moves the whole slice when the stay has not arrived', () => {
    const plan = planDoorMove({
      slices: [slice({ id: 's1', fromDate: day('2026-10-20'), toDate: day('2026-10-24') })],
      fromRoomId: 'old',
      toRoomId: 'new',
      effective: day('2026-10-20'),
      dayKey: hotelDateKey,
    });
    expect(plan.creates).toEqual([]);
    expect(plan.updates).toEqual([{ id: 's1', roomId: 'new' }]);
  });

  it('keeps nights before today on the old door and opens a tail on the new door', () => {
    const plan = planDoorMove({
      slices: [slice({ id: 's1', fromDate: day('2026-10-08'), toDate: day('2026-10-20') })],
      fromRoomId: 'old',
      toRoomId: 'new',
      effective: day('2026-10-13'),
      dayKey: hotelDateKey,
    });
    expect(plan.updates).toEqual([{ id: 's1', toDate: day('2026-10-13') }]);
    expect(plan.creates).toEqual([
      {
        fromDate: day('2026-10-13'),
        toDate: day('2026-10-20'),
        roomId: 'new',
        roomTypeId: 'type',
        ratePlanId: 'rate',
      },
    ]);
  });

  it('leaves a slice with no door and a pending future door alone', () => {
    const plan = planDoorMove({
      slices: [
        slice({ id: 'open', fromDate: day('2026-10-08'), toDate: day('2026-10-20'), roomId: null }),
        slice({ id: 'later', fromDate: day('2026-10-15'), toDate: day('2026-10-20'), roomId: 'planned' }),
      ],
      fromRoomId: 'old',
      toRoomId: 'new',
      effective: day('2026-10-13'),
      keepRoomIds: ['planned'],
      dayKey: hotelDateKey,
    });
    expect(plan.updates).toEqual([]);
    expect(plan.creates).toEqual([]);
  });
});

describe('forwardDoorGaps', () => {
  it('opens a tail when the only slice ended before the move', () => {
    const slices = [slice({ id: 's1', fromDate: day('2026-10-17'), toDate: day('2026-10-23') })];
    const plan = planDoorMove({
      slices,
      fromRoomId: 'old',
      toRoomId: 'new',
      effective: day('2026-10-25'),
      dayKey: hotelDateKey,
    });
    expect(plan.creates).toEqual([]);
    const gaps = forwardDoorGaps({
      slices,
      updates: plan.updates,
      creates: plan.creates,
      effective: day('2026-10-25'),
      checkOut: day('2026-10-31'),
      toRoomId: 'new',
      dayKey: hotelDateKey,
    });
    expect(gaps).toEqual([
      {
        fromDate: day('2026-10-25'),
        toDate: day('2026-10-31'),
        roomId: 'new',
        roomTypeId: 'type',
        ratePlanId: 'rate',
      },
    ]);
  });

  it('does not add a second tail when the destination already covers checkout', () => {
    const slices = [
      slice({ id: 'past', fromDate: day('2026-10-20'), toDate: day('2026-10-22'), roomId: 'old' }),
      slice({ id: 'now', fromDate: day('2026-10-22'), toDate: day('2026-10-28'), roomId: 'new' }),
    ];
    expect(
      forwardDoorGaps({
        slices,
        updates: [],
        creates: [],
        effective: day('2026-10-25'),
        checkOut: day('2026-10-28'),
        toRoomId: 'new',
        dayKey: hotelDateKey,
      }),
    ).toEqual([]);
  });

  it('does not duplicate a tail the move plan already opened', () => {
    const slices = [slice({ id: 's1', fromDate: day('2026-10-17'), toDate: day('2026-10-31') })];
    const plan = planDoorMove({
      slices,
      fromRoomId: 'old',
      toRoomId: 'new',
      effective: day('2026-10-25'),
      dayKey: hotelDateKey,
    });
    expect(
      forwardDoorGaps({
        slices,
        updates: plan.updates,
        creates: plan.creates,
        effective: day('2026-10-25'),
        checkOut: day('2026-10-31'),
        toRoomId: 'new',
        dayKey: hotelDateKey,
      }),
    ).toEqual([]);
  });
});

describe('dedupPair', () => {
  it('orders the two guest ids so a dismissal is one row', () => {
    expect(dedupPair('b', 'a')).toEqual({ guestIdLow: 'a', guestIdHigh: 'b' });
    expect(dedupPair('a', 'b')).toEqual(dedupPair('b', 'a'));
  });
});
