import { isFreeStayBilling, shouldOffsetHouseUse } from '@/lib/stay-billing';

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
});
