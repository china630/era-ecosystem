import {
  attachGuestToPax,
  countsFromPax,
  guestFitsSlot,
  isIncompletePax,
  placeGuestOnPaxRow,
  syncPaxToBandCounts,
} from '@/components/reservation-card/party-pax';

const emptyCounts = { children5_2: 0, children1_0: 0 };

function party() {
  return syncPaxToBandCounts(
    [],
    { adults: 2, children11_6: 1, ...emptyCounts },
    false,
  );
}

describe('party age bands', () => {
  it('builds one row per counter band', () => {
    const rows = party();
    expect(countsFromPax(rows)).toEqual({
      adults: 2,
      children11_6: 1,
      children5_2: 0,
      children1_0: 0,
    });
  });

  it('search appends an adult instead of filling a child slot', () => {
    const namedAdults = party().map((row, i) =>
      row.age === '' ? { ...row, firstName: `Adult${i}`, lastName: 'X' } : row,
    );
    const attached = attachGuestToPax(
      namedAdults,
      { id: 'maral', firstName: 'Maral', lastName: 'X', birthDate: '1972-03-01' },
      { equalMode: false, reservationGuestId: 'booker' },
    );
    expect(attached.grew).toBe(true);
    expect(countsFromPax(attached.pax)).toEqual({
      adults: 3,
      children11_6: 1,
      children5_2: 0,
      children1_0: 0,
    });
    const without = attached.pax.filter((row) => row.guestId !== 'maral');
    expect(countsFromPax(without).adults).toBe(2);
    expect(countsFromPax(without).children11_6).toBe(1);
  });

  it('fills a child slot with a child and leaves the adult count', () => {
    const attached = attachGuestToPax(
      party(),
      { id: 'kid', firstName: 'Kid', lastName: 'Y', birthDate: '2018-05-01' },
      { equalMode: false, reservationGuestId: 'booker' },
    );
    expect(attached.grew).toBe(false);
    expect(countsFromPax(attached.pax).adults).toBe(2);
    expect(countsFromPax(attached.pax).children11_6).toBe(1);
    expect(attached.pax.some((row) => row.guestId === 'kid')).toBe(true);
  });

  it('dropping the child counter removes the empty child row only', () => {
    const shrunk = syncPaxToBandCounts(
      party(),
      { adults: 2, children11_6: 0, ...emptyCounts },
      false,
    );
    expect(shrunk).toHaveLength(2);
    expect(countsFromPax(shrunk).adults).toBe(2);
    expect(countsFromPax(shrunk).children11_6).toBe(0);
  });

  it('counts age 14 as an adult and skips a departed guest', () => {
    const rows = party().map((row, i) => {
      if (i === 0) return { ...row, firstName: 'Teen', lastName: 'T', birthDate: '2012-01-01', age: '14' };
      if (i === 1) return { ...row, firstName: 'Gone', lastName: 'G', departedAt: '2026-10-01' };
      return row;
    });
    const counts = countsFromPax(rows);
    expect(counts.adults).toBe(1);
    expect(counts.children11_6).toBe(1);
  });

  it('does not drop a named child when the counter is lowered', () => {
    const named = party().map((row) =>
      row.age === '8'
        ? { ...row, firstName: 'Kid', lastName: 'Z', birthDate: '2018-05-01' }
        : row,
    );
    const shrunk = syncPaxToBandCounts(
      named,
      { adults: 2, children11_6: 0, ...emptyCounts },
      false,
    );
    expect(shrunk.some((row) => row.firstName === 'Kid')).toBe(true);
    expect(countsFromPax(shrunk).children11_6).toBe(1);
  });

  it('refuses an adult birth date on a child slot and accepts a missing birth date', () => {
    const child = party().find((row) => row.age === '8');
    expect(child).toBeTruthy();
    expect(guestFitsSlot('1981-07-07', child!)).toBe(false);
    expect(guestFitsSlot('2018-05-01', child!)).toBe(true);
    expect(guestFitsSlot('', child!)).toBe(true);
  });

  it('keeps a guestId row complete even without a typed name', () => {
    expect(isIncompletePax({ firstName: '', lastName: '', guestId: 'g1' })).toBe(false);
    expect(isIncompletePax({ firstName: '', lastName: '', guestId: '' })).toBe(true);
  });

  it('placeGuestOnPaxRow fills the clicked adult row with a child and rebands', () => {
    const rows = party();
    const adultIdx = rows.findIndex((row) => row.age === '');
    expect(adultIdx).toBeGreaterThanOrEqual(0);
    const placed = placeGuestOnPaxRow(
      rows,
      adultIdx,
      { id: 'kid2', firstName: 'Nara', lastName: 'Y', birthDate: '2018-05-01' },
      { equalMode: false, reservationGuestId: 'booker' },
    );
    expect(placed.rebander).toBe(true);
    expect(placed.grew).toBe(false);
    expect(placed.pax[adultIdx]?.guestId).toBe('kid2');
    expect(placed.pax[adultIdx]?.firstName).toBe('Nara');
    expect(countsFromPax(placed.pax).children11_6).toBe(2);
  });

  it('placeGuestOnPaxRow does not leave the clicked row empty', () => {
    const rows = party();
    const emptyAdult = rows.findIndex((row) => !row.firstName && row.age === '');
    const placed = placeGuestOnPaxRow(
      rows,
      emptyAdult,
      { id: 'a2', firstName: 'Ada', lastName: 'B', birthDate: '1990-01-01' },
      { equalMode: false, reservationGuestId: 'booker' },
    );
    expect(placed.pax[emptyAdult]?.guestId).toBe('a2');
    expect(placed.rebander).toBe(false);
  });
});
