import { classSettlementChoices, doorTypeNeedsSettlement } from '../src/lib/room-move-settlement';

describe('doorTypeNeedsSettlement', () => {
  it('asks when the door class differs from the charged type', () => {
    expect(doorTypeNeedsSettlement('stwn', 'sdbl', 'sdbl')).toBe(true);
    expect(doorTypeNeedsSettlement('stwn', 'stwn', 'stwn')).toBe(false);
  });
});

describe('classSettlementChoices', () => {
  it('offers the upgrade pair when the door is not cheaper', () => {
    expect(classSettlementChoices(100, 120)).toEqual(['HOTEL', 'GUEST_PAY']);
    expect(classSettlementChoices(null, null)).toEqual(['HOTEL', 'GUEST_PAY']);
  });

  it('offers the downgrade pair when the door is cheaper', () => {
    expect(classSettlementChoices(120, 80)).toEqual(['HOTEL_REFUND', 'GUEST_CHEAPER']);
  });
});
