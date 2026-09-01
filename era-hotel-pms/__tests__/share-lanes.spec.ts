import { assignSharePaintLanes, shareLaneCount } from '@/components/room-plan/share-lanes';

describe('share paint lanes', () => {
  it('keeps vacated bed for chain: A to 10 bed1, B to 5 bed2, C from 6 → lane 1', () => {
    const a = {
      id: 'a',
      checkInDate: '2026-06-01',
      checkOutDate: '2026-06-10',
      shareEligible: true,
      shareGender: 'M',
      adults: 1,
      shareBedIndex: 1,
    };
    const b = {
      id: 'b',
      checkInDate: '2026-06-01',
      checkOutDate: '2026-06-05',
      shareEligible: true,
      shareGender: 'M',
      adults: 1,
      shareBedIndex: 2,
    };
    const c = {
      id: 'c',
      checkInDate: '2026-06-06',
      checkOutDate: '2026-06-12',
      shareEligible: true,
      shareGender: 'M',
      adults: 1,
      shareBedIndex: 2,
    };
    const lanes = assignSharePaintLanes([a, b, c], 2);
    expect(lanes.get('a')).toBe(0);
    expect(lanes.get('b')).toBe(1);
    expect(lanes.get('c')).toBe(1);
  });

  it('never paints overlapping stays on the same lane even with bad bed index', () => {
    const a = {
      id: 'a',
      checkInDate: '2026-06-01',
      checkOutDate: '2026-06-10',
      shareEligible: true,
      shareGender: 'M',
      adults: 1,
      shareBedIndex: 1,
    };
    const c = {
      id: 'c',
      checkInDate: '2026-06-06',
      checkOutDate: '2026-06-12',
      shareEligible: true,
      shareGender: 'M',
      adults: 1,
      shareBedIndex: 1, // wrong — would overlay A
    };
    const lanes = assignSharePaintLanes([a, c], 2);
    expect(lanes.get('a')).toBe(0);
    expect(lanes.get('c')).not.toBe(0);
  });

  it('counts at least capacity lanes when share present', () => {
    const a = {
      id: 'a',
      checkInDate: '2026-06-01',
      checkOutDate: '2026-06-10',
      shareEligible: true,
      shareGender: 'F',
      adults: 1,
      shareBedIndex: 1,
    };
    expect(shareLaneCount([a], 2)).toBe(2);
  });

  it('307-like two share bars on parallel lanes', () => {
    const aqil = {
      id: 'aqil',
      checkInDate: '2026-08-20',
      checkOutDate: '2026-08-27',
      shareEligible: true,
      shareGender: 'M',
      adults: 1,
      shareBedIndex: 1,
    };
    const rovsen = {
      id: 'rovsen',
      checkInDate: '2026-08-21',
      checkOutDate: '2026-08-28',
      shareEligible: true,
      shareGender: 'M',
      adults: 1,
      shareBedIndex: 2,
    };
    const lanes = assignSharePaintLanes([aqil, rovsen], 2);
    expect(lanes.get('aqil')).toBe(0);
    expect(lanes.get('rovsen')).toBe(1);
    expect(shareLaneCount([aqil, rovsen], 2)).toBe(2);
  });
});
