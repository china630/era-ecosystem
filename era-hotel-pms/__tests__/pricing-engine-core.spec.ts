import { Prisma } from '@prisma/client';
import {
  applyDerivation,
  assembleQuote,
  buildNightlyRoomRates,
  computeAddOnAmount,
  computeAddOnQuantity,
  computeChildNightlyAddon,
  computeOccupancyNightlySupplement,
  DEFAULT_CHILD_PRICING_MATRIX,
  resolveChildDiscountPercent,
} from '@/lib/services/pricing-engine-core';

describe('pricing-engine-core', () => {
  describe('applyDerivation', () => {
    it('applies percent discount', () => {
      expect(applyDerivation(100, 'PERCENT', -10).toNumber()).toBe(90);
    });

    it('applies percent supplement', () => {
      expect(applyDerivation(100, 'PERCENT', 15).toNumber()).toBe(115);
    });

    it('applies fixed delta', () => {
      expect(applyDerivation(80, 'FIXED', 5).toNumber()).toBe(85);
    });

    it('floors at zero', () => {
      expect(applyDerivation(10, 'FIXED', -20).toNumber()).toBe(0);
    });

    it('rounds to two decimal places', () => {
      expect(applyDerivation(99.99, 'PERCENT', -10).toNumber()).toBe(89.99);
    });
  });

  describe('computeAddOnAmount', () => {
    it('PER_GUEST_NIGHT multiplies by guests and nights', () => {
      expect(computeAddOnAmount(15, 'PER_GUEST_NIGHT', 3, 2).toNumber()).toBe(90);
    });

    it('PER_STAY charges once', () => {
      expect(computeAddOnAmount(50, 'PER_STAY', 5, 3).toNumber()).toBe(50);
    });
  });

  describe('computeAddOnQuantity', () => {
    it('returns guest-night multiplier', () => {
      expect(computeAddOnQuantity('PER_GUEST_NIGHT', 3, 2)).toBe(6);
    });
  });

  describe('buildNightlyRoomRates', () => {
    it('derives per night from BAR', () => {
      const nights = buildNightlyRoomRates(
        [
          { date: '2026-06-01', amount: new Prisma.Decimal(100) },
          { date: '2026-06-02', amount: new Prisma.Decimal(120) },
        ],
        { mode: 'PERCENT', value: new Prisma.Decimal(-10) },
      );
      expect(nights[0].amount.toNumber()).toBe(90);
      expect(nights[1].amount.toNumber()).toBe(108);
    });
  });

  describe('child pricing', () => {
    it('uses default matrix for age 8 (50% pay)', () => {
      expect(resolveChildDiscountPercent(8, [])).toBe(50);
    });

    it('free children 0-6 add no nightly addon', () => {
      const addon = computeChildNightlyAddon(
        100,
        [{ count: 2, representativeAge: 3 }],
        DEFAULT_CHILD_PRICING_MATRIX,
      );
      expect(addon.toNumber()).toBe(0);
    });

    it('child 7-11 pays half of adult nightly', () => {
      const addon = computeChildNightlyAddon(
        100,
        [{ count: 1, representativeAge: 8 }],
        DEFAULT_CHILD_PRICING_MATRIX,
      );
      expect(addon.toNumber()).toBe(50);
    });

    it('absolute override charges paying children only', () => {
      const addon = computeChildNightlyAddon(
        100,
        [{ count: 2, representativeAge: 3 }],
        [{ ageFrom: 0, ageTo: 6, discountPercent: 0, amountOverride: 40, freeCount: 1 }],
        { useAbsolutePricing: true },
      );
      expect(addon.toNumber()).toBe(40);
    });
  });

  describe('occupancy supplement', () => {
    it('charges second and third adult tiers', () => {
      const amount = computeOccupancyNightlySupplement({
        adults: 3,
        baseOccupancy: 1,
        extraAdultAmount: 31,
        thirdAdultAmount: 31,
        extraBeds: 1,
        extraBedAmount: 20,
      });
      expect(amount.toNumber()).toBe(82);
    });
  });

  describe('assembleQuote', () => {
    it('separates room and add-on revenue', () => {
      const quote = assembleQuote({
        currency: 'AZN',
        nights: 2,
        roomRevenueCode: 'ROOM',
        nightlyRates: [
          {
            date: '2026-06-01',
            barAmount: new Prisma.Decimal(100),
            amount: new Prisma.Decimal(100),
          },
          {
            date: '2026-06-02',
            barAmount: new Prisma.Decimal(100),
            amount: new Prisma.Decimal(100),
          },
        ],
        addOns: [
          {
            addOnCode: 'BB',
            revenueCode: 'FOOD',
            inclusion: 'INCLUDED',
            pricingUnit: 'PER_GUEST_NIGHT',
            unitPrice: 10,
          },
        ],
        guests: 2,
      });

      expect(quote.room.total).toBe(200);
      expect(quote.addOnTotal).toBe(40);
      expect(quote.grandTotal).toBe(240);
      expect(quote.room.revenueCode).toBe('ROOM');
      expect(quote.addOns[0].revenueCode).toBe('FOOD');
    });
  });
});
