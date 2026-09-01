import {
  buildGuestExternalRefLookup,
  buildGuestNameLookup,
  guestIndexKeys,
  normalizeGuestExternalRef,
  resolveGuestExternalRefFromName,
  resolveGuestIdFromName,
  splitReservationGuestParts,
  type GuestCardRefRow,
  type GuestLookupRow,
} from '@/lib/import/resolve-reservation-guest';

function guest(
  id: string,
  partial: Partial<GuestLookupRow> & Pick<GuestLookupRow, 'fullName'>,
): GuestLookupRow {
  return {
    id,
    firstName: null,
    lastName: null,
    middleName: null,
    externalRef: id,
    ...partial,
  };
}

function card(
  externalRef: string,
  partial: Partial<GuestCardRefRow> & Pick<GuestCardRefRow, 'fullName'>,
): GuestCardRefRow {
  return {
    externalRef,
    firstName: null,
    middleName: null,
    lastName: null,
    ...partial,
  };
}

describe('resolve-reservation-guest', () => {
  const cardRow = guest('g1', {
    firstName: 'Ədalət',
    middleName: 'Məmməd',
    lastName: 'Hüseynov',
    fullName: 'Ədalət Məmməd Hüseynov',
    externalRef: '1001',
  });

  const lookup = buildGuestNameLookup([cardRow]);
  const extLookup = buildGuestExternalRefLookup([
    card('1001', {
      firstName: 'Ədalət',
      middleName: 'Məmməd',
      lastName: 'Hüseynov',
      fullName: 'Ədalət Məmməd Hüseynov',
    }),
  ]);

  it('indexes composed and reversed names', () => {
    const keys = guestIndexKeys(cardRow);
    expect(keys.some((k) => k.includes('edalet'))).toBe(true);
    expect(keys.some((k) => k.includes('huseynov'))).toBe(true);
  });

  it('matches FO Guest Name with patronymic order to Guest.id', () => {
    expect(resolveGuestIdFromName('Ədalət Məmməd Hüseynov', lookup)).toBe('g1');
  });

  it('matches FO Guest Name to Elektraweb Guest Id', () => {
    expect(resolveGuestExternalRefFromName('Hüseynov Ədalət', extLookup)).toBe('1001');
  });

  it('normalizes Guest Id cell', () => {
    expect(normalizeGuestExternalRef(' 1001 ')).toBe('1001');
    expect(normalizeGuestExternalRef('NaN')).toBeNull();
  });

  it('matches split multi-guest string when one part hits', () => {
    expect(resolveGuestIdFromName('999 FB / Ədalət Məmməd Hüseynov', lookup)).toBe('g1');
  });

  it('does not match unrelated surname-only string', () => {
    expect(resolveGuestIdFromName('Hüseynov Zaur', lookup)).toBeNull();
  });

  it('skips house ledger labels', () => {
    expect(splitReservationGuestParts('999 FB')).toEqual([]);
    expect(resolveGuestIdFromName('999 FB', lookup)).toBeNull();
  });

  it('returns null when two different guests match two parts', () => {
    const lookup2 = buildGuestNameLookup([
      cardRow,
      guest('g2', {
        firstName: 'Zaur',
        lastName: 'Rəcəbov',
        fullName: 'Zaur Rəcəbov',
        externalRef: '1002',
      }),
    ]);
    expect(resolveGuestIdFromName('Ədalət Məmməd Hüseynov / Zaur Rəcəbov', lookup2)).toBeNull();
  });
});
