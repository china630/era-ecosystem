import { describe, expect, it } from 'vitest';

/**
 * Pure policy mirror of resolveRoutedFolioType room/tax branch
 * (booking-folio.service) — keeps the desk law testable without Prisma.
 */
function roomTaxTarget(stay: {
  roomPayer: 'GUEST' | 'AGENCY' | 'COMPANY';
  companyId: string | null;
  agencyId: string | null;
}): 'GUEST' | 'AGENCY' | 'COMPANY' {
  if (stay.roomPayer === 'COMPANY' && stay.companyId) return 'COMPANY';
  if (stay.roomPayer === 'AGENCY' && stay.agencyId) return 'AGENCY';
  if (stay.roomPayer === 'GUEST' && stay.companyId && !stay.agencyId) return 'COMPANY';
  return 'GUEST';
}

describe('room payer routing policy', () => {
  it('agency alone keeps ROOM on the guest', () => {
    expect(
      roomTaxTarget({ roomPayer: 'GUEST', companyId: null, agencyId: 'a1' }),
    ).toBe('GUEST');
  });

  it('agency pays when roomPayer is AGENCY', () => {
    expect(
      roomTaxTarget({ roomPayer: 'AGENCY', companyId: null, agencyId: 'a1' }),
    ).toBe('AGENCY');
  });

  it('company pays when roomPayer is COMPANY', () => {
    expect(
      roomTaxTarget({ roomPayer: 'COMPANY', companyId: 'c1', agencyId: null }),
    ).toBe('COMPANY');
  });

  it('legacy company-only stay without explicit agency still routes ROOM to company', () => {
    expect(
      roomTaxTarget({ roomPayer: 'GUEST', companyId: 'c1', agencyId: null }),
    ).toBe('COMPANY');
  });
});
