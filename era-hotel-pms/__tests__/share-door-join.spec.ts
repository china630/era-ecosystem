import { canJoinOccupiedDoor } from '@/lib/share-door-join';

describe('canJoinOccupiedDoor', () => {
  const mShare = { shareEligible: true, shareGender: 'M', adults: 1 };
  const fShare = { shareEligible: true, shareGender: 'F', adults: 1 };
  const exclusive = { shareEligible: false, shareGender: null, adults: 1 };
  const family = { shareEligible: false, shareGender: null, adults: 2 };

  it('allows empty door', () => {
    expect(
      canJoinOccupiedDoor({
        candidate: { shareEligible: false, adults: 2, gender: null },
        overlapping: [],
        maxBed: 2,
      }),
    ).toBe(true);
  });

  it('blocks exclusive / family occupancy', () => {
    expect(
      canJoinOccupiedDoor({
        candidate: { shareEligible: true, adults: 1, gender: 'F' },
        overlapping: [exclusive],
        maxBed: 2,
      }),
    ).toBe(false);
    expect(
      canJoinOccupiedDoor({
        candidate: { shareEligible: true, adults: 1, gender: 'M' },
        overlapping: [family],
        maxBed: 2,
      }),
    ).toBe(false);
  });

  it('allows same-gender open pool when a bed remains', () => {
    expect(
      canJoinOccupiedDoor({
        candidate: { shareEligible: true, adults: 1, gender: 'M' },
        overlapping: [mShare],
        maxBed: 2,
      }),
    ).toBe(true);
  });

  it('allows closed pair: share-eligible opposite onto a singleton share door', () => {
    expect(
      canJoinOccupiedDoor({
        candidate: { shareEligible: true, adults: 1, gender: 'F' },
        overlapping: [mShare],
        maxBed: 2,
      }),
    ).toBe(true);
  });

  it('blocks a third guest on a live closed pair', () => {
    expect(
      canJoinOccupiedDoor({
        candidate: { shareEligible: true, adults: 1, gender: 'M' },
        overlapping: [mShare, fShare],
        maxBed: 2,
      }),
    ).toBe(false);
  });

  it('blocks opposite join when candidate is not share-eligible', () => {
    expect(
      canJoinOccupiedDoor({
        candidate: { shareEligible: false, adults: 1, gender: 'F' },
        overlapping: [mShare],
        maxBed: 2,
      }),
    ).toBe(false);
  });
});
