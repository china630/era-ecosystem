import {
  classifyAmendmentFolioImpact,
  physicalTypeAllowedForDoor,
  rateAdjExternalRef,
  scaleLinesToSell,
  splitStayAmounts,
} from '@/lib/services/door-type.policy';
import { nextSlicesAfterProductChange } from '@/lib/services/stay-slice.math';

describe('door-type.policy', () => {
  it('allows same charged type', () => {
    expect(
      physicalTypeAllowedForDoor({
        chargedRoomTypeId: 'std',
        givenRoomTypeId: null,
        doorRoomTypeId: 'std',
        compUpgrade: false,
      }).ok,
    ).toBe(true);
  });

  it('allows given type without paid product change', () => {
    expect(
      physicalTypeAllowedForDoor({
        chargedRoomTypeId: 'std',
        givenRoomTypeId: 'dlx',
        doorRoomTypeId: 'dlx',
        compUpgrade: false,
      }).ok,
    ).toBe(true);
  });

  it('allows other type only as complimentary upgrade', () => {
    const paid = physicalTypeAllowedForDoor({
      chargedRoomTypeId: 'std',
      givenRoomTypeId: null,
      doorRoomTypeId: 'dlx',
      compUpgrade: false,
    });
    expect(paid.ok).toBe(false);
    expect(
      physicalTypeAllowedForDoor({
        chargedRoomTypeId: 'std',
        givenRoomTypeId: null,
        doorRoomTypeId: 'dlx',
        compUpgrade: true,
      }).ok,
    ).toBe(true);
  });
});

describe('scaleLinesToSell', () => {
  it('scales package lines so sum equals sell', () => {
    const scaled = scaleLinesToSell([{ amount: 90 }, { amount: 60 }, { amount: 30 }], 120);
    expect(scaled.reduce((a, b) => a + b, 0)).toBeCloseTo(120, 2);
  });
});

describe('splitStayAmounts', () => {
  it('puts remainder qapiks on the last night', () => {
    const amounts = splitStayAmounts(10, 3);
    expect(amounts).toEqual([3.33, 3.33, 3.34]);
    expect(amounts.reduce((a, b) => a + b, 0)).toBeCloseTo(10, 2);
  });
});

describe('RATE_ADJ idempotency key', () => {
  it('is stable per reservation and business date', () => {
    expect(rateAdjExternalRef('r1', '2026-08-24')).toBe('rate-adj:r1:2026-08-24');
  });
});

describe('classifyAmendmentFolioImpact', () => {
  it('uses FUTURE_EOD when tonight is not posted', () => {
    expect(
      classifyAmendmentFolioImpact({
        tonightPosted: false,
        effectiveIsToday: true,
        differenceAmount: 12,
      }),
    ).toBe('FUTURE_EOD');
  });

  it('uses DIFFERENCE_LINE when tonight is posted and amounts differ', () => {
    expect(
      classifyAmendmentFolioImpact({
        tonightPosted: true,
        effectiveIsToday: true,
        differenceAmount: 12,
      }),
    ).toBe('DIFFERENCE_LINE');
  });
});

describe('nextSlicesAfterProductChange', () => {
  it('shrinks the overlapping slice and appends the new product window', () => {
    expect(
      nextSlicesAfterProductChange(
        [{ fromDate: '2026-08-01', toDate: '2026-08-10', roomTypeId: 'A', ratePlanId: '1' }],
        '2026-08-05',
        '2026-08-10',
        'B',
        '2',
      ),
    ).toEqual([
      { fromDate: '2026-08-01', toDate: '2026-08-05', roomTypeId: 'A', ratePlanId: '1' },
      { fromDate: '2026-08-05', toDate: '2026-08-10', roomTypeId: 'B', ratePlanId: '2' },
    ]);
  });
});
