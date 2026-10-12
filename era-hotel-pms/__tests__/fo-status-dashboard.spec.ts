import { buildFoStatus, stayBucket, type DashStay, type FoStatusInput } from '@/lib/services/fo-status-dashboard.math';

function stay(partial: Partial<DashStay> & Pick<DashStay, 'id' | 'status' | 'inYmd' | 'outYmd'>): DashStay {
  return {
    roomId: null,
    roomNumber: null,
    roomCount: 1,
    createdYmd: partial.inYmd,
    updatedYmd: partial.inYmd,
    nights: partial.inYmd === partial.outYmd ? 1 : 1,
    adults: 1,
    child1: 0,
    child2: 0,
    baby: 0,
    share: false,
    walkIn: false,
    group: false,
    accomType: null,
    mealCode: 'BB',
    roomTypeCode: 'STD',
    roomTypeName: 'Standard',
    guestId: partial.id,
    guestName: partial.id,
    guestVisits: 1,
    birthYmd: null,
    channel: 'OTHERS',
    folios: [],
    billTo: 'GUEST',
    paymentMethod: 'CASH',
    totalAmount: 100,
    ...partial,
  };
}

function base(stays: DashStay[], extra?: Partial<FoStatusInput>): FoStatusInput {
  return {
    day: '2026-10-12',
    monthStart: '2026-10-01',
    mtdDays: 12,
    forecastDays: ['2026-10-12', '2026-10-13'],
    capacity: 78,
    bedCapacity: 126,
    includeWaiting: false,
    withRevenue: true,
    stays,
    rooms: [],
    roomTypeQuota: [{ code: 'STD', name: 'Standard', quota: 78 }],
    charges: [],
    nightRates: [],
    ...extra,
  };
}

describe('fo status dashboard', () => {
  it('classifies stay buckets in Elektra order', () => {
    expect(stayBucket(stay({ id: 'a', status: 'NO_SHOW', inYmd: '2026-10-12', outYmd: '2026-10-14', share: true }))).toBe('NS');
    expect(stayBucket(stay({ id: 'b', status: 'OPTION', inYmd: '2026-10-12', outYmd: '2026-10-14' }))).toBe('OT');
    expect(stayBucket(stay({ id: 'c', status: 'IN_HOUSE', inYmd: '2026-10-12', outYmd: '2026-10-12' }))).toBe('DU');
    expect(stayBucket(stay({ id: 'd', status: 'IN_HOUSE', inYmd: '2026-10-10', outYmd: '2026-10-14', share: true }))).toBe('SHR');
    expect(stayBucket(stay({ id: 'e', status: 'IN_HOUSE', inYmd: '2026-10-10', outYmd: '2026-10-14', walkIn: true }))).toBe('WO');
    expect(stayBucket(stay({ id: 'f', status: 'IN_HOUSE', inYmd: '2026-10-10', outYmd: '2026-10-14' }))).toBe('NR');
  });

  it('keeps start + arrivals − departures equal to current in-house rooms', () => {
    const snap = buildFoStatus(
      base([
        stay({ id: 'stay', status: 'IN_HOUSE', inYmd: '2026-10-10', outYmd: '2026-10-20', roomId: 'r1', adults: 2 }),
        stay({ id: 'arr', status: 'IN_HOUSE', inYmd: '2026-10-12', outYmd: '2026-10-15', roomId: 'r2', adults: 1 }),
        stay({ id: 'dep', status: 'CHECKED_OUT', inYmd: '2026-10-08', outYmd: '2026-10-12', roomId: 'r3', adults: 2 }),
        stay({ id: 'exp', status: 'CONFIRMED', inYmd: '2026-10-12', outYmd: '2026-10-18', roomId: null, adults: 1 }),
      ]),
    );
    const row = (key: string) => snap.movement.find((r) => r.key === key)!;
    expect(row('start').rooms + row('realizedArrivals').rooms - row('realizedDepartures').rooms).toBe(row('current').rooms);
    expect(snap.inHouse.rooms).toBe(2);
    expect(snap.inHouse.adults).toBe(3);
    expect(snap.expectedArrivals.rooms).toBe(1);
    expect(snap.endOfDay.rooms).toBe(3);
    expect(row('current').percent).toBe(2.56);
    expect(snap.forecast[0].meals.breakfast.adults).toBe(snap.forecast[0].adults);
    expect(snap.forecast[0].meals.lunch.adults).toBe(0);
    expect(snap.forecast[0].meals.dinner.adults).toBe(0);
  });

  it('buckets night guests by age, visit count, channel and folio window', () => {
    const snap = buildFoStatus(
      base([
        stay({
          id: 'old',
          status: 'IN_HOUSE',
          inYmd: '2026-10-10',
          outYmd: '2026-10-20',
          roomId: 'r1',
          guestId: 'g1',
          birthYmd: '1960-01-01',
          guestVisits: 0,
          channel: 'Walkin medical',
          createdYmd: '2026-10-12',
        }),
        stay({
          id: 'young',
          status: 'IN_HOUSE',
          inYmd: '2026-10-10',
          outYmd: '2026-10-20',
          roomId: 'r2',
          guestId: 'g2',
          birthYmd: null,
          guestVisits: 1,
          channel: 'FOTON MMC',
          billTo: 'AGENCY',
          createdYmd: '2026-10-12',
        }),
        stay({
          id: 'child',
          status: 'IN_HOUSE',
          inYmd: '2026-10-11',
          outYmd: '2026-10-18',
          roomId: 'r3',
          guestId: 'g3',
          birthYmd: '2016-06-01',
          guestVisits: 0,
          folios: ['GUEST', 'COMPANY'],
          createdYmd: '2026-10-01',
        }),
      ]),
    );
    expect(snap.ageBands.find((band) => band.key === 'age40')?.count).toBe(1);
    expect(snap.ageBands.find((band) => band.key === 'age7')?.count).toBe(1);
    expect(snap.ageBands.find((band) => band.key === 'ageUnknown')?.count).toBe(1);
    expect(snap.repeatBuckets).toEqual([
      { visits: 0, guests: 2 },
      { visits: 1, guests: 1 },
    ]);
    expect(snap.todaySources).toEqual([
      { label: 'Walkin medical', count: 1 },
      { label: 'FOTON MMC', count: 1 },
    ]);
    expect(snap.folioTypes).toEqual([
      { type: 'GUEST', count: 2 },
      { type: 'AGENCY', count: 1 },
      { type: 'COMPANY', count: 1 },
    ]);
  });

  it('counts a shared door once and keeps a mixed group on the group series', () => {
    const snap = buildFoStatus(
      base([
        stay({ id: 'a', status: 'IN_HOUSE', inYmd: '2026-10-01', outYmd: '2026-10-20', roomId: 'door', share: true, adults: 1 }),
        stay({ id: 'b', status: 'IN_HOUSE', inYmd: '2026-10-01', outYmd: '2026-10-20', roomId: 'door', share: true, adults: 1, group: true }),
      ]),
    );
    expect(snap.inHouse.rooms).toBe(1);
    expect(snap.inHouse.shr).toBe(1);
    expect(snap.inHouse.pax).toBe(2);
    expect(snap.forecast[0].group).toBe(1);
    expect(snap.forecast[0].individual).toBe(0);
  });

  it('rolls month-to-date sales into ADR', () => {
    const snap = buildFoStatus(
      base([
        stay({
          id: 'new',
          status: 'CONFIRMED',
          inYmd: '2026-11-01',
          outYmd: '2026-11-04',
          createdYmd: '2026-10-05',
          nights: 3,
          totalAmount: 300,
          adults: 2,
        }),
      ]),
    );
    expect(snap.sales.resCount).toBe(1);
    expect(snap.sales.roomNights).toBe(3);
    expect(snap.sales.adr).toBe(100);
    expect(snap.sales.roomPercent).toBeCloseTo((3 / (78 * 12)) * 100, 2);
  });

  it('keeps a daily rate off a night the stay does not cover', () => {
    const snap = buildFoStatus(
      base(
        [
          stay({ id: 'in', status: 'IN_HOUSE', inYmd: '2026-10-01', outYmd: '2026-10-20', roomId: 'r1' }),
          stay({ id: 'later', status: 'CONFIRMED', inYmd: '2026-10-20', outYmd: '2026-10-22' }),
        ],
        {
          nightRates: [
            { day: '2026-10-12', reservationId: 'in', amount: 80 },
            { day: '2026-10-12', reservationId: 'later', amount: 50 },
          ],
        },
      ),
    );
    expect(snap.forecast[0].revenue).toBe(80);
  });
});
