import { doorAssignBlock } from '../src/lib/door-assign-reason';

const base = {
  id: 'r1',
  roomNumber: '1002',
  roomTypeId: 'sdbl',
  roomTypeCode: 'SDBL',
  status: 'AVAILABLE' as const,
  hkCondition: 'CLEAN' as const,
  inventoryStatus: 'IN_SERVICE' as const,
};

describe('doorAssignBlock', () => {
  it('blocks a different physical type', () => {
    expect(
      doorAssignBlock(base, { needTypeId: 'stwn', needTypeCode: 'STWN', inHouse: false, occupied: false }),
    ).toEqual({ code: 'WRONG_TYPE', doorType: 'SDBL', needType: 'STWN' });
  });

  it('blocks OOS and OOO before type-ready checks', () => {
    expect(
      doorAssignBlock(
        { ...base, roomTypeId: 'stwn', inventoryStatus: 'OOS', status: 'OOS' },
        { needTypeId: 'stwn', needTypeCode: 'STWN', inHouse: false, occupied: false },
      ),
    ).toEqual({ code: 'OOS' });
    expect(
      doorAssignBlock(
        { ...base, roomTypeId: 'stwn', inventoryStatus: 'OOO', status: 'OOO' },
        { needTypeId: 'stwn', needTypeCode: 'STWN', inHouse: false, occupied: false },
      ),
    ).toEqual({ code: 'OOO' });
  });

  it('lets a dirty door be booked before check-in', () => {
    expect(
      doorAssignBlock(
        { ...base, roomTypeId: 'stwn', hkCondition: 'DIRTY', status: 'DIRTY' },
        { needTypeId: 'stwn', needTypeCode: 'STWN', inHouse: false, occupied: false },
      ),
    ).toBeNull();
  });

  it('blocks a dirty door for an in-house move', () => {
    expect(
      doorAssignBlock(
        { ...base, roomTypeId: 'stwn', hkCondition: 'DIRTY', status: 'DIRTY' },
        { needTypeId: 'stwn', needTypeCode: 'STWN', inHouse: true, occupied: false },
      ),
    ).toEqual({ code: 'DIRTY' });
  });

  it('keeps the already assigned door selectable', () => {
    expect(
      doorAssignBlock(
        { ...base, inventoryStatus: 'OOS', status: 'OOS' },
        { needTypeId: 'sdbl', inHouse: false, occupied: false, currentAssignedId: 'r1' },
      ),
    ).toBeNull();
  });
});
