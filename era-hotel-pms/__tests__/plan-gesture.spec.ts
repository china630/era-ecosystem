import { commitPlanGesture } from '@/components/room-plan/plan-gesture';

const stay = {
  reservationId: 'r1',
  status: 'CONFIRMED',
  fromRoomId: 'a',
  toRoomId: 'a',
  checkIn: '2026-10-21T08:00:00.000Z',
  checkOut: '2026-10-24T08:00:00.000Z',
};

describe('commitPlanGesture', () => {
  it('shifts the whole interval and can change room without folding room into a date-only result', () => {
    const shifted = commitPlanGesture({ ...stay, mode: 'move', deltaDays: 2, toRoomId: 'b' });
    expect(shifted).toMatchObject({
      kind: 'apply',
      checkIn: '2026-10-23T08:00:00.000Z',
      checkOut: '2026-10-26T08:00:00.000Z',
      toRoomId: 'b',
    });
  });

  it('moves either edge and keeps at least one night', () => {
    expect(commitPlanGesture({ ...stay, mode: 'start', deltaDays: 1 })).toMatchObject({
      checkIn: '2026-10-22T08:00:00.000Z',
      checkOut: stay.checkOut,
    });
    expect(commitPlanGesture({ ...stay, mode: 'end', deltaDays: -5 })).toMatchObject({
      checkOut: '2026-10-22T08:00:00.000Z',
    });
  });

  it('does not move an in-house arrival and asks before an early departure', () => {
    const inHouse = { ...stay, status: 'IN_HOUSE' };
    expect(commitPlanGesture({ ...inHouse, mode: 'start', deltaDays: 1 }).kind).toBe('noop');
    expect(commitPlanGesture({ ...inHouse, mode: 'end', deltaDays: -1 }).kind).toBe('early-checkout');
    expect(commitPlanGesture({ ...inHouse, mode: 'end', deltaDays: 1 })).toMatchObject({
      kind: 'apply',
      checkOut: '2026-10-25T08:00:00.000Z',
    });
    expect(commitPlanGesture({ ...inHouse, mode: 'move', deltaDays: 2, toRoomId: 'b' })).toEqual({
      kind: 'apply',
      reservationId: 'r1',
      toRoomId: 'b',
    });
  });

  it('assigns an unassigned stay onto the drop day with the same length', () => {
    const assigned = commitPlanGesture({
      ...stay,
      mode: 'assign',
      deltaDays: 0,
      fromRoomId: null,
      toRoomId: 'c',
      assignCheckIn: '2026-11-02T08:00:00.000Z',
    });
    expect(assigned).toMatchObject({
      kind: 'apply',
      checkIn: '2026-11-02T08:00:00.000Z',
      checkOut: '2026-11-05T08:00:00.000Z',
      toRoomId: 'c',
    });
  });
});
