import { earlyCheckoutSliceAction, parseEarlyCheckoutRevert } from '@/lib/early-checkout-revert';
import { priceNoteChoosesHotel, priceNoteHasClassSettlement } from '@/lib/class-settlement-note';

describe('early checkout slice window', () => {
  const end = new Date('2026-10-22T00:00:00.000Z');

  it('keeps a door already left on the move morning', () => {
    expect(
      earlyCheckoutSliceAction(
        {
          fromDate: new Date('2026-10-20T00:00:00.000Z'),
          toDate: new Date('2026-10-22T00:00:00.000Z'),
        },
        end,
      ),
    ).toBe('keep');
  });

  it('drops a slice that starts on the departure morning', () => {
    expect(
      earlyCheckoutSliceAction(
        {
          fromDate: new Date('2026-10-22T00:00:00.000Z'),
          toDate: new Date('2026-10-28T00:00:00.000Z'),
        },
        end,
      ),
    ).toBe('delete');
  });

  it('shortens a slice that still has nights before departure', () => {
    expect(
      earlyCheckoutSliceAction(
        {
          fromDate: new Date('2026-10-20T00:00:00.000Z'),
          toDate: new Date('2026-10-28T00:00:00.000Z'),
        },
        end,
      ),
    ).toBe('shorten');
  });

  it('reads a revert snapshot', () => {
    expect(
      parseEarlyCheckoutRevert({
        checkOut: '2026-10-28T08:00:00.000Z',
        totalAmount: '1112',
        rates: [],
        slices: [],
      })?.checkOut,
    ).toBe('2026-10-28T08:00:00.000Z');
    expect(parseEarlyCheckoutRevert({ checkOut: 'x' })).toBeNull();
  });
});

describe('class settlement note', () => {
  it('treats a recorded hotel choice as already answered', () => {
    const note = 'Отель покрывает разницу классов (без доплаты).';
    expect(priceNoteChoosesHotel(note)).toBe(true);
    expect(priceNoteHasClassSettlement(note)).toBe(true);
    expect(priceNoteChoosesHotel('')).toBe(false);
  });
});
