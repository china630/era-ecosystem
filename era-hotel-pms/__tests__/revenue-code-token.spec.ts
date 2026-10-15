import {
  LODGING_ROLES,
  STAY_NIGHT_ROLES,
  isRevenueCodeRole,
  revenueRoleIn,
  revenueRoleIs,
} from '../src/lib/revenue-code-match';
import { isRoomAndTaxRevenueCode } from '../src/lib/services/booking-folio.service';

describe('revenueRoleIs', () => {
  it('matches on the system role, not on code or name', () => {
    expect(revenueRoleIs({ systemRole: 'ROOM' }, 'ROOM')).toBe(true);
    expect(revenueRoleIs({ systemRole: null }, 'ROOM')).toBe(false);
  });

  it('treats a missing row as no role', () => {
    expect(revenueRoleIs(null, 'ROOM')).toBe(false);
    expect(revenueRoleIs(undefined, 'ROOM')).toBe(false);
  });
});

describe('revenueRoleIn', () => {
  it('accepts stay-night roles only', () => {
    expect(revenueRoleIn({ systemRole: 'PKG' }, STAY_NIGHT_ROLES)).toBe(true);
    expect(revenueRoleIn({ systemRole: 'FOOD' }, STAY_NIGHT_ROLES)).toBe(false);
    expect(revenueRoleIn({ systemRole: null }, STAY_NIGHT_ROLES)).toBe(false);
  });

  it('counts treatment and board as lodging on early checkout', () => {
    expect(revenueRoleIn({ systemRole: 'TREATMENT' }, LODGING_ROLES)).toBe(true);
    expect(revenueRoleIn({ systemRole: 'BOARD' }, LODGING_ROLES)).toBe(true);
    expect(revenueRoleIn({ systemRole: 'MINIBAR' }, LODGING_ROLES)).toBe(false);
  });
});

describe('isRevenueCodeRole', () => {
  it('rejects tokens that are not roles', () => {
    expect(isRevenueCodeRole('CITY_TAX')).toBe(true);
    expect(isRevenueCodeRole('LODGING')).toBe(false);
    expect(isRevenueCodeRole(10)).toBe(false);
  });
});

describe('isRoomAndTaxRevenueCode', () => {
  it('puts room nights and city tax on the room-and-tax folio', () => {
    expect(isRoomAndTaxRevenueCode({ systemRole: 'ROOM' })).toBe(true);
    expect(isRoomAndTaxRevenueCode({ systemRole: 'CITY_TAX' })).toBe(true);
    expect(isRoomAndTaxRevenueCode({ systemRole: 'FOOD' })).toBe(false);
  });

  it('keeps a code with no role off room and tax unless a rate plan uses it', () => {
    expect(isRoomAndTaxRevenueCode({ systemRole: null })).toBe(false);
    expect(isRoomAndTaxRevenueCode({ systemRole: null, ratePlansRoom: [{ id: 'rp' }] })).toBe(true);
  });
});
