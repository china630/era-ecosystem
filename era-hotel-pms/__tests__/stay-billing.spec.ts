import {
  chargeNeedsFreeStayOffset,
  dayQtyPurpose,
  isFreeStayBilling,
  shouldOffsetHouseUse,
} from '@/lib/stay-billing';

describe('stay billing', () => {
  it('treats compliment and house use as free room nights', () => {
    expect(isFreeStayBilling('COMP')).toBe(true);
    expect(isFreeStayBilling('HOUSE')).toBe(true);
    expect(isFreeStayBilling('NORMAL')).toBe(false);
  });

  it('offsets a house-use extra once', () => {
    expect(shouldOffsetHouseUse({ billingMode: 'HOUSE', amount: 12 })).toBe(true);
    expect(
      shouldOffsetHouseUse({ billingMode: 'HOUSE', amount: 12, externalRef: 'house-use:abc' }),
    ).toBe(false);
    expect(shouldOffsetHouseUse({ billingMode: 'COMP', amount: 12 })).toBe(false);
    expect(shouldOffsetHouseUse({ billingMode: 'HOUSE', amount: 0 })).toBe(false);
  });

  it('credits posted lodging on compliment and the whole folio on house use', () => {
    const refs = new Set<string>();
    expect(
      chargeNeedsFreeStayOffset({
        billingMode: 'COMP',
        systemRole: 'PKG',
        amount: 80,
        chargeId: 'c1',
        existingRefs: refs,
      }),
    ).toBe(true);
    expect(
      chargeNeedsFreeStayOffset({
        billingMode: 'COMP',
        systemRole: 'FOOD',
        amount: 12,
        chargeId: 'c2',
        existingRefs: refs,
      }),
    ).toBe(false);
    expect(
      chargeNeedsFreeStayOffset({
        billingMode: 'HOUSE',
        systemRole: 'FOOD',
        amount: 12,
        chargeId: 'c2',
        existingRefs: refs,
      }),
    ).toBe(true);
    refs.add('comp-stay:c1');
    expect(
      chargeNeedsFreeStayOffset({
        billingMode: 'COMP',
        systemRole: 'PKG',
        amount: 80,
        chargeId: 'c1',
        existingRefs: refs,
      }),
    ).toBe(false);
  });

  it('does not count a compliment stay night as a sale', () => {
    expect(dayQtyPurpose('COMP', 80, 'PKG')).toBe('comp');
    expect(dayQtyPurpose('COMP', 12, 'FOOD')).toBe('sale');
    expect(dayQtyPurpose('HOUSE', 12, 'FOOD')).toBe('house_use');
    expect(dayQtyPurpose('NORMAL', 80, 'ROOM')).toBe('sale');
  });
});
