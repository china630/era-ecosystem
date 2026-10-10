import { roomPlanSpans } from '@/lib/services/room-plan-spans';

const dayKey = (date: Date) => {
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${date.getUTCFullYear()}-${month}-${day}`;
};

describe('roomPlanSpans', () => {
  it('paints the head on the door it left and the tail on the new door', () => {
    const headFrom = new Date('2026-10-01T12:00:00.000Z');
    const split = new Date('2026-10-05T12:00:00.000Z');
    const checkOut = new Date('2026-10-15T12:00:00.000Z');
    const { placed, unplaced } = roomPlanSpans({
      reservationId: 'stay-1',
      roomId: 'deluxe',
      checkIn: headFrom,
      checkOut,
      slices: [
        { id: 'head', fromDate: headFrom, toDate: split, roomId: null },
        { id: 'tail', fromDate: split, toDate: checkOut, roomId: 'deluxe' },
      ],
      changes: [{ fromRoomId: 'standard', effectiveAt: split }],
      dayKey,
    });
    expect(unplaced).toEqual([]);
    expect(placed.map((span) => [span.roomId, span.key])).toEqual([
      ['standard', 'stay-1:head'],
      ['deluxe', 'stay-1:tail'],
    ]);
  });
});
