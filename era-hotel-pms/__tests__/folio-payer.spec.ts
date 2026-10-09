import { accountBalance, pickTargetFolio, resolvePayer } from '../src/lib/folio-payer';

describe('resolvePayer', () => {
  const a = { id: 'a', name: 'Ana', isPrimary: false };
  const b = { id: 'b', name: 'Ben', isPrimary: true, ownsFolio: true };

  it('fixes a single named guest', () => {
    expect(resolvePayer([a])).toEqual({ kind: 'fixed', guest: a });
  });

  it('fixes the primary when several guests are named', () => {
    expect(resolvePayer([a, b])).toEqual({ kind: 'fixed', guest: b });
  });

  it('asks for a guest when nobody is primary', () => {
    expect(resolvePayer([a, { ...b, isPrimary: false }])).toEqual({ kind: 'pick' });
  });
});

describe('pickTargetFolio', () => {
  const shared = { id: 's', type: 'GUEST', status: 'OPEN', reservationGuestId: null };
  const personal = { id: 'p', type: 'GUEST', status: 'OPEN', reservationGuestId: 'b' };
  const agency = { id: 'ag', type: 'AGENCY', status: 'OPEN', reservationGuestId: null };

  it('uses the personal folio when the guest owns one', () => {
    expect(pickTargetFolio([shared, personal], 'guest', { id: 'b', name: 'Ben', isPrimary: true, ownsFolio: true })).toBe(
      personal,
    );
  });

  it('uses the shared guest folio otherwise', () => {
    expect(pickTargetFolio([shared, personal], 'guest', { id: 'a', name: 'Ana', isPrimary: true })).toBe(shared);
  });

  it('uses the agency folio from the agency tab', () => {
    expect(pickTargetFolio([shared, agency], 'agency')).toBe(agency);
  });
});

describe('accountBalance', () => {
  it('nets refunds and quantity', () => {
    expect(
      accountBalance({
        charges: [{ amount: 10, qty: 2 }],
        payments: [
          { amount: 5, kind: 'PAYMENT' },
          { amount: 3, kind: 'REFUND' },
        ],
      }),
    ).toBe(18);
  });
});
