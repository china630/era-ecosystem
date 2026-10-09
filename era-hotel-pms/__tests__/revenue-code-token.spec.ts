import { matchesAnyRevenueToken, revenueTokenMatches } from '../src/lib/revenue-code-token';
import { isRoomAndTaxRevenueCode } from '../src/lib/services/booking-folio.service';

describe('revenueTokenMatches', () => {
  it('matches the Elektra name when the code is numeric', () => {
    expect(revenueTokenMatches({ code: '10', name: 'ROOM' }, 'ROOM')).toBe(true);
  });

  it('still matches a canonical code', () => {
    expect(revenueTokenMatches({ code: 'ROOM', name: 'Room revenue' }, 'room')).toBe(true);
  });

  it('does not treat a different name as the token', () => {
    expect(revenueTokenMatches({ code: '11', name: 'FOOD' }, 'ROOM')).toBe(false);
  });
});

describe('matchesAnyRevenueToken', () => {
  it('accepts lodging tokens on either field', () => {
    expect(matchesAnyRevenueToken({ code: '10', name: 'ROOM' }, ['ROOM', 'PKG'])).toBe(true);
    expect(matchesAnyRevenueToken({ code: '11', name: 'FOOD' }, ['ROOM', 'PKG'])).toBe(false);
  });
});

describe('isRoomAndTaxRevenueCode', () => {
  it('treats an Elektra room row as room and tax', () => {
    expect(isRoomAndTaxRevenueCode({ code: '10', name: 'ROOM', taxTag: '18.00' })).toBe(true);
    expect(isRoomAndTaxRevenueCode({ code: '11', name: 'FOOD', taxTag: '18.00' })).toBe(false);
  });
});
