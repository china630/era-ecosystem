import {
  buildGuestNameLookup,
  planReservationPaxFromParts,
  resolveGuestIdForNamePart,
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

describe('planReservationPaxFromParts', () => {
  const lookup = buildGuestNameLookup([
    guest('g-mahir', {
      firstName: 'Mahir',
      lastName: 'Əsədov',
      fullName: 'Mahir Əsədov',
      externalRef: '90353377',
    }),
    guest('g-gulduze', {
      firstName: 'Gülduzə',
      lastName: 'Əsədova',
      fullName: 'Gülduzə Əsədova',
      externalRef: '90353378',
    }),
  ]);

  it('creates primary + companion rows from slash-separated names', () => {
    const rows = planReservationPaxFromParts(
      ['Mahir Əsədov', 'Gülduzə Əsədova'],
      'g-mahir',
      lookup,
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      guestId: 'g-mahir',
      isPrimary: true,
      sortOrder: 0,
    });
    expect(rows[1]).toMatchObject({
      guestId: 'g-gulduze',
      isPrimary: false,
      sortOrder: 1,
    });
  });

  it('keeps primary guest id when only first part resolves', () => {
    const rows = planReservationPaxFromParts(
      ['Mahir Əsədov', 'Unknown Person'],
      'g-mahir',
      lookup,
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].guestId).toBe('g-mahir');
    expect(rows[1].guestId).toBeNull();
    expect(rows[1].displayName).toBe('Unknown Person');
  });

  it('dedupes when two parts resolve to the same guest', () => {
    const rows = planReservationPaxFromParts(
      ['Mahir Əsədov', 'Mahir Əsədov'],
      'g-mahir',
      lookup,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.guestId).toBe('g-mahir');
  });

  it('returns single primary row when parts list is empty', () => {
    expect(planReservationPaxFromParts([], 'g-mahir', lookup)).toEqual([
      {
        guestId: 'g-mahir',
        displayName: '',
        isPrimary: true,
        sortOrder: 0,
      },
    ]);
  });
});

describe('resolveGuestIdForNamePart', () => {
  const lookup = buildGuestNameLookup([
    guest('g1', {
      firstName: 'Zaur',
      lastName: 'Rəcəbov',
      fullName: 'Zaur Rəcəbov',
      externalRef: '1002',
    }),
  ]);

  it('matches one fragment without requiring whole party uniqueness', () => {
    expect(resolveGuestIdForNamePart('Zaur Rəcəbov', lookup)).toBe('g1');
  });
});
