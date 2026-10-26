import { bakuCivilUtcDate } from '@era/satellite-kit/time';
import { parseHotelNoon } from '@/lib/hotel-calendar';
import { segmentsConsumingType, type InventoryStay } from '@/lib/services/share-assignment.service';
import { alignStaySlices, type AlignSlice } from '@/lib/services/stay-slice-align';

const day = (ymd: string) => bakuCivilUtcDate(ymd);

function slice(partial: Partial<AlignSlice> & Pick<AlignSlice, 'id' | 'fromDate' | 'toDate'>): AlignSlice {
  return {
    roomId: '1006',
    roomTypeId: 'sdbl',
    ratePlanId: 'bar',
    ...partial,
  };
}

describe('alignStaySlices', () => {
  const stay = {
    checkIn: new Date('2026-10-14T10:00:00.000Z'),
    checkOut: new Date('2026-10-28T08:00:00.000Z'),
    roomId: 'room-1006',
    roomTypeId: 'sdbl',
    ratePlanId: 'bar',
  };

  it('cuts a slice that runs past the header checkout and keeps the tariff', () => {
    const plan = alignStaySlices({
      ...stay,
      slices: [slice({ id: 'long', fromDate: day('2026-10-14'), toDate: day('2027-01-22') })],
    });
    expect(plan.deletes).toEqual([]);
    expect(plan.creates).toEqual([]);
    expect(plan.updates).toEqual([{ id: 'long', toDate: day('2026-10-28') }]);
  });

  it('drops a slice that starts on the checkout day', () => {
    const plan = alignStaySlices({
      ...stay,
      slices: [slice({ id: 'after', fromDate: day('2026-10-28'), toDate: day('2026-11-02') })],
    });
    expect(plan.deletes).toEqual(['after']);
    expect(plan.updates).toEqual([]);
  });

  it('pins a missing door without rewriting the sold type', () => {
    const plan = alignStaySlices({
      ...stay,
      roomId: 'room-705',
      checkIn: new Date('2026-10-25T10:00:00.000Z'),
      checkOut: new Date('2026-11-04T08:00:00.000Z'),
      slices: [
        slice({
          id: 'open',
          fromDate: day('2026-10-25'),
          toDate: day('2026-12-04'),
          roomId: null,
        }),
      ],
    });
    expect(plan.updates).toEqual([
      { id: 'open', toDate: day('2026-11-04'), roomId: 'room-705' },
    ]);
    expect(plan.updates[0]).not.toHaveProperty('roomTypeId');
  });

  it('extends the last slice when the stay grows on the same door', () => {
    const plan = alignStaySlices({
      ...stay,
      checkOut: new Date('2026-11-04T08:00:00.000Z'),
      slices: [slice({ id: 's', fromDate: day('2026-10-14'), toDate: day('2026-10-28'), roomId: 'room-1006' })],
    });
    expect(plan.creates).toEqual([]);
    expect(plan.updates).toEqual([{ id: 's', toDate: day('2026-11-04') }]);
  });

  it('fills an internal hole on the header door and keeps the neighbour tariff', () => {
    const plan = alignStaySlices({
      ...stay,
      roomId: 'room-1002',
      roomTypeId: 'stwn',
      checkIn: new Date('2026-10-17T10:00:00.000Z'),
      checkOut: new Date('2026-10-31T08:00:00.000Z'),
      slices: [
        slice({
          id: 'a',
          fromDate: day('2026-10-17'),
          toDate: day('2026-10-23'),
          roomId: 'room-704',
          roomTypeId: 'stwn',
          ratePlanId: 'fb',
        }),
        slice({
          id: 'b',
          fromDate: day('2026-10-25'),
          toDate: day('2026-10-31'),
          roomId: 'room-1002',
          roomTypeId: 'stwn',
          ratePlanId: 'fb',
        }),
      ],
    });
    expect(plan.updates).toEqual([]);
    expect(plan.creates).toEqual([
      {
        fromDate: day('2026-10-23'),
        toDate: day('2026-10-25'),
        roomId: 'room-1002',
        roomTypeId: 'stwn',
        ratePlanId: 'fb',
      },
    ]);
  });

  it('is a no-op when the slice already matches the header', () => {
    const plan = alignStaySlices({
      ...stay,
      slices: [slice({ id: 'ok', fromDate: day('2026-10-14'), toDate: day('2026-10-28'), roomId: 'room-1006' })],
    });
    expect(plan).toEqual({ updates: [], deletes: [], creates: [] });
  });
});

describe('segmentsConsumingType', () => {
  const night = parseHotelNoon('2026-10-26');

  function stay(partial: Partial<InventoryStay> & Pick<InventoryStay, 'id'>): InventoryStay {
    return {
      roomId: null,
      roomTypeId: 'sdbl',
      doorTypeId: null,
      shareEligible: false,
      shareGender: null,
      adults: 1,
      checkInDate: new Date('2026-10-14T10:00:00.000Z'),
      checkOutDate: new Date('2026-10-28T08:00:00.000Z'),
      slices: [],
      ...partial,
    };
  }

  it('counts an assigned door as the physical type, not the slice tariff', () => {
    const rows = segmentsConsumingType('jsuit', [
      stay({
        id: 'moved',
        roomId: 'room-311',
        roomTypeId: 'jsuit',
        doorTypeId: 'jsuit',
        slices: [
          {
            fromDate: day('2026-10-25'),
            toDate: day('2026-11-04'),
            roomId: 'room-311',
            roomTypeId: 'sdbl',
            doorTypeId: 'jsuit',
          },
        ],
      }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.roomId).toBe('room-311');
    expect(segmentsConsumingType('sdbl', [
      stay({
        id: 'moved',
        roomId: 'room-311',
        roomTypeId: 'jsuit',
        doorTypeId: 'jsuit',
        slices: [
          {
            fromDate: day('2026-10-25'),
            toDate: day('2026-11-04'),
            roomId: 'room-311',
            roomTypeId: 'sdbl',
            doorTypeId: 'jsuit',
          },
        ],
      }),
    ])).toEqual([]);
    expect(night.toISOString()).toBe('2026-10-26T08:00:00.000Z');
  });

  it('keeps an unassigned slice on the sold type', () => {
    const rows = segmentsConsumingType('sdbl', [
      stay({
        id: 'wait',
        slices: [
          {
            fromDate: day('2026-10-26'),
            toDate: day('2026-10-28'),
            roomId: null,
            roomTypeId: 'sdbl',
            doorTypeId: null,
          },
        ],
      }),
    ]);
    expect(rows).toEqual([
      expect.objectContaining({ id: 'wait', roomId: null }),
    ]);
  });

  it('does not let a slice past the header checkout keep the door', () => {
    const rows = segmentsConsumingType('sdbl', [
      stay({
        id: 'short-header',
        roomId: 'room-1006',
        doorTypeId: 'sdbl',
        slices: [
          {
            fromDate: day('2026-10-14'),
            toDate: day('2027-01-22'),
            roomId: 'room-1006',
            roomTypeId: 'sdbl',
            doorTypeId: 'sdbl',
          },
        ],
      }),
    ]);
    expect(rows[0]?.checkOutDate.toISOString()).toBe(parseHotelNoon('2026-10-28').toISOString());
  });
});
