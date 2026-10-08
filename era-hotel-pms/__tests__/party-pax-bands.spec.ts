import {
  attachGuestToPax,
  countsFromPax,
  guestFitsSlot,
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
});
