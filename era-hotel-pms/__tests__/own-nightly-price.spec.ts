import { usesBarCalendar } from '../src/lib/pricing/own-nightly-price';

describe('usesBarCalendar', () => {
  it('quotes a BASE plan from its own calendar', () => {
    expect(usesBarCalendar({ type: 'BASE', derivedFromId: null })).toBe(true);
  });

  it('quotes a derivation that has a parent and an adjustment', () => {
    expect(
      usesBarCalendar({
        type: 'DERIVED',
        derivedFromId: 'bar',
        adjustmentMode: 'PERCENT',
        adjustmentValue: -10,
      }),
    ).toBe(true);
  });

  it('keeps an Elektra code with no parent on its own price', () => {
    expect(
      usesBarCalendar({
        type: 'DERIVED',
        derivedFromId: null,
        adjustmentMode: null,
        adjustmentValue: null,
      }),
    ).toBe(false);
  });

  it('keeps a parentless adjustment off the BAR engine', () => {
    expect(
      usesBarCalendar({
        type: 'DERIVED',
        derivedFromId: null,
        adjustmentMode: 'PERCENT',
        adjustmentValue: -10,
      }),
    ).toBe(false);
  });
});
