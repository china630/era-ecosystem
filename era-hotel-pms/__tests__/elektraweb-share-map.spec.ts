import {
  applyElektrawebSharePair,
  genderFromElektrawebGuest,
  isElektrawebShareSecond,
  isShareRoomNumberSuffix,
  physicalRoomNumber,
  type ShareMapDb,
} from '@/lib/integration/elektraweb-share-map';
import { countDoorsUsedOnNight } from '@/lib/services/share-assignment.service';

function makeDb(state: {
  reservations: Map<
    string,
    {
      id: string;
      roomId: string | null;
      adults: number;
      shareEligible: boolean;
      shareGender: string | null;
      shareBedIndex: number | null;
      checkInDate: Date;
      checkOutDate: Date;
      status: string;
      guest: { sex: string | null; title: string | null };
      agency: { code: string; name: string } | null;
      room: {
        id: string;
        maxBed: number | null;
        roomType: { adultCapacity: number | null };
      } | null;
    }
  >;
}): ShareMapDb {
  return {
    reservation: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        state.reservations.get(where.id) ?? null,
      findMany: async ({
        where,
      }: {
        where: { roomId?: string; status?: { in: string[] } };
      }) => {
        const roomId = where.roomId;
        const statuses = where.status?.in;
        return [...state.reservations.values()].filter((r) => {
          if (r.roomId !== roomId) return false;
          if (statuses && !statuses.includes(r.status)) return false;
          return true;
        });
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<{
          shareEligible: boolean;
          shareGender: string | null;
          shareBedIndex: number | null;
          shareNo: string | null;
        }>;
      }) => {
        const row = state.reservations.get(where.id);
        if (!row) throw new Error('missing');
        Object.assign(row, data);
        return row;
      },
    },
  };
}

function stay(partial: {
  id: string;
  roomId?: string;
  adults?: number;
  shareEligible?: boolean;
  shareGender?: string | null;
  shareBedIndex?: number | null;
  checkIn: string;
  checkOut: string;
  status?: string;
  sex?: string | null;
  agency?: { code: string; name: string } | null;
  maxBed?: number;
}) {
  const roomId = partial.roomId ?? 'room-707';
  return {
    id: partial.id,
    roomId,
    adults: partial.adults ?? 1,
    shareEligible: partial.shareEligible ?? false,
    shareGender: partial.shareGender ?? null,
    shareBedIndex: partial.shareBedIndex ?? null,
    checkInDate: new Date(partial.checkIn),
    checkOutDate: new Date(partial.checkOut),
    status: partial.status ?? 'CONFIRMED',
    guest: { sex: partial.sex !== undefined ? partial.sex : 'M', title: null },
    agency: partial.agency ?? { code: 'UNION', name: 'Hamkarlar' },
    room: {
      id: roomId,
      maxBed: partial.maxBed ?? 2,
      roomType: { adultCapacity: partial.maxBed ?? 2 },
    },
  };
}

describe('elektraweb-share-map', () => {
  describe('physicalRoomNumber / second signal', () => {
    it('strips 707S to 707 and ignores garbage ...S', () => {
      expect(physicalRoomNumber('707S')).toBe('707');
      expect(physicalRoomNumber('707s')).toBe('707');
      expect(physicalRoomNumber('707')).toBe('707');
      expect(physicalRoomNumber('...S')).toBe('...S');
      expect(isShareRoomNumberSuffix('707S')).toBe(true);
      expect(isShareRoomNumberSuffix('707')).toBe(false);
      expect(isShareRoomNumberSuffix('...S')).toBe(false);
    });

    it('detects second guest via SHARE, roomCount 0, or S suffix', () => {
      expect(isElektrawebShareSecond({ recordType: 'SHARE', rawRoomNumber: '707' })).toBe(
        true,
      );
      expect(
        isElektrawebShareSecond({ roomCount: 0, rawRoomNumber: '707' }),
      ).toBe(true);
      expect(isElektrawebShareSecond({ rawRoomNumber: '707S' })).toBe(true);
      expect(
        isElektrawebShareSecond({
          recordType: 'NORMAL',
          roomCount: 1,
          rawRoomNumber: '707',
        }),
      ).toBe(false);
    });

    it('maps guest gender from Gender or Title', () => {
      expect(genderFromElektrawebGuest({ gender: 'Male' })).toBe('M');
      expect(genderFromElektrawebGuest({ gender: 'Female' })).toBe('F');
      expect(genderFromElektrawebGuest({ title: 'Mr' })).toBe('M');
      expect(genderFromElektrawebGuest({ title: 'Mrs' })).toBe('F');
      expect(genderFromElektrawebGuest({ gender: null, title: null })).toBeNull();
    });
  });

  describe('applyElektrawebSharePair', () => {
    it('1. SHARE second pulls NORMAL neighbor — both share, 1 door', async () => {
      const normal = stay({
        id: 'elnur',
        checkIn: '2026-08-22T10:00:00Z',
        checkOut: '2026-08-29T08:00:00Z',
        sex: 'M',
      });
      const share = stay({
        id: 'yaqub',
        checkIn: '2026-08-22T10:00:00Z',
        checkOut: '2026-08-31T08:00:00Z',
        sex: 'M',
      });
      const state = { reservations: new Map([[normal.id, normal], [share.id, share]]) };
      const db = makeDb(state);

      const result = await applyElektrawebSharePair(db, {
        reservationId: 'yaqub',
        isSecond: true,
      });

      expect(result.applied).toBe(true);
      expect(result.pairedIds.sort()).toEqual(['elnur', 'yaqub']);
      expect(normal.shareEligible).toBe(true);
      expect(share.shareEligible).toBe(true);
      expect(normal.shareBedIndex).toBe(1);
      expect(share.shareBedIndex).toBe(2);
      expect(normal.shareGender).toBe('M');

      const night = new Date('2026-08-25T00:00:00Z');
      expect(
        countDoorsUsedOnNight(
          [
            {
              id: normal.id,
              roomId: normal.roomId,
              shareEligible: normal.shareEligible,
              shareGender: normal.shareGender,
              adults: 1,
              checkInDate: normal.checkInDate,
              checkOutDate: normal.checkOutDate,
              shareBedIndex: normal.shareBedIndex,
            },
            {
              id: share.id,
              roomId: share.roomId,
              shareEligible: share.shareEligible,
              shareGender: share.shareGender,
              adults: 1,
              checkInDate: share.checkInDate,
              checkOutDate: share.checkOutDate,
              shareBedIndex: share.shareBedIndex,
            },
          ],
          night,
          2,
        ),
      ).toBe(1);
    });

    it('2. SHARE first then NORMAL joins existing pool', async () => {
      const share = stay({
        id: 'yaqub',
        checkIn: '2026-08-22T10:00:00Z',
        checkOut: '2026-08-31T08:00:00Z',
        sex: 'M',
      });
      const state = { reservations: new Map([[share.id, share]]) };
      const db = makeDb(state);

      await applyElektrawebSharePair(db, { reservationId: 'yaqub', isSecond: true });
      expect(share.shareEligible).toBe(true);

      const normal = stay({
        id: 'elnur',
        checkIn: '2026-08-22T10:00:00Z',
        checkOut: '2026-08-29T08:00:00Z',
        sex: 'M',
      });
      state.reservations.set(normal.id, normal);

      const result = await applyElektrawebSharePair(db, {
        reservationId: 'elnur',
        isSecond: false,
      });
      expect(result.applied).toBe(true);
      expect(normal.shareEligible).toBe(true);
      expect(new Set([normal.shareBedIndex, share.shareBedIndex])).toEqual(new Set([1, 2]));
    });

    it('3. 707S resolves via physical door — no virtual room', () => {
      expect(physicalRoomNumber('707S')).toBe('707');
      expect(isShareRoomNumberSuffix('707S')).toBe(true);
    });

    it('4. walk-in NORMAL without SHARE neighbor stays exclusive; with SHARE joins', async () => {
      const walkin = stay({
        id: 'walk',
        checkIn: '2026-08-22T10:00:00Z',
        checkOut: '2026-08-25T08:00:00Z',
        sex: 'M',
        agency: { code: 'WALKIN', name: 'Walkin medical' },
      });
      const state = { reservations: new Map([[walkin.id, walkin]]) };
      const db = makeDb(state);

      const alone = await applyElektrawebSharePair(db, {
        reservationId: 'walk',
        isSecond: false,
      });
      expect(alone.applied).toBe(false);
      expect(walkin.shareEligible).toBe(false);

      const second = stay({
        id: 'walk2',
        checkIn: '2026-08-22T10:00:00Z',
        checkOut: '2026-08-28T08:00:00Z',
        sex: 'M',
        agency: { code: 'WALKIN', name: 'Walkin medical' },
      });
      state.reservations.set(second.id, second);
      await applyElektrawebSharePair(db, { reservationId: 'walk2', isSecond: true });
      expect(walkin.shareEligible).toBe(true);
      expect(second.shareEligible).toBe(true);
    });

    it('5. NORMAL re-apply with live SHARE does not clear share', async () => {
      const normal = stay({
        id: 'elnur',
        shareEligible: true,
        shareGender: 'M',
        shareBedIndex: 1,
        checkIn: '2026-08-22T10:00:00Z',
        checkOut: '2026-08-29T08:00:00Z',
      });
      const share = stay({
        id: 'yaqub',
        shareEligible: true,
        shareGender: 'M',
        shareBedIndex: 2,
        checkIn: '2026-08-22T10:00:00Z',
        checkOut: '2026-08-31T08:00:00Z',
      });
      const state = { reservations: new Map([[normal.id, normal], [share.id, share]]) };
      const db = makeDb(state);

      await applyElektrawebSharePair(db, { reservationId: 'elnur', isSecond: false });
      expect(normal.shareEligible).toBe(true);
      expect(share.shareEligible).toBe(true);
    });

    it('6. EW NORMAL alone after first-out clears orphan shareEligible', async () => {
      const remaining = stay({
        id: 'yaqub',
        shareEligible: true,
        shareGender: 'M',
        shareBedIndex: 2,
        checkIn: '2026-08-22T10:00:00Z',
        checkOut: '2026-08-31T08:00:00Z',
        status: 'IN_HOUSE',
      });
      const state = { reservations: new Map([[remaining.id, remaining]]) };
      const db = makeDb(state);

      const result = await applyElektrawebSharePair(db, {
        reservationId: 'yaqub',
        isSecond: false,
      });
      expect(result.cleared).toBe(true);
      expect(result.skippedReason).toBe('orphan_cleared');
      expect(remaining.shareEligible).toBe(false);
      expect(remaining.shareGender).toBeNull();
      expect(remaining.shareBedIndex).toBeNull();
    });

    it('6b. CHECKED_OUT former roommate does not reopen live share', async () => {
      const live = stay({
        id: 'live',
        shareEligible: false,
        checkIn: '2026-09-02T10:00:00Z',
        checkOut: '2026-09-12T08:00:00Z',
        status: 'IN_HOUSE',
        sex: 'F',
      });
      const gone = stay({
        id: 'gone',
        shareEligible: true,
        shareGender: 'F',
        shareBedIndex: 2,
        checkIn: '2026-09-02T10:00:00Z',
        checkOut: '2026-09-10T08:00:00Z',
        status: 'CHECKED_OUT',
        sex: 'F',
      });
      const state = { reservations: new Map([[live.id, live], [gone.id, gone]]) };
      const db = makeDb(state);
      const result = await applyElektrawebSharePair(db, {
        reservationId: 'live',
        isSecond: false,
      });
      expect(result.applied).toBe(false);
      expect(live.shareEligible).toBe(false);
    });

    it('6c. adults>1 clears shareEligible', async () => {
      const family = stay({
        id: 'fam',
        adults: 3,
        shareEligible: true,
        shareGender: 'F',
        shareBedIndex: 1,
        checkIn: '2026-09-02T10:00:00Z',
        checkOut: '2026-09-12T08:00:00Z',
        status: 'IN_HOUSE',
        sex: 'F',
      });
      const db = makeDb({ reservations: new Map([[family.id, family]]) });
      const result = await applyElektrawebSharePair(db, {
        reservationId: 'fam',
        isSecond: false,
      });
      expect(result.cleared).toBe(true);
      expect(result.skippedReason).toBe('adults_not_1');
      expect(family.shareEligible).toBe(false);
    });

    it('7. CHECKED_OUT history pair counts as 1 door (includeHistory)', async () => {
      const a = stay({
        id: 'a',
        status: 'CHECKED_OUT',
        checkIn: '2026-06-01T10:00:00Z',
        checkOut: '2026-06-10T08:00:00Z',
        sex: 'F',
      });
      const b = stay({
        id: 'b',
        status: 'CHECKED_OUT',
        checkIn: '2026-06-03T10:00:00Z',
        checkOut: '2026-06-12T08:00:00Z',
        sex: 'F',
      });
      const state = { reservations: new Map([[a.id, a], [b.id, b]]) };
      const db = makeDb(state);
      await applyElektrawebSharePair(db, {
        reservationId: 'b',
        isSecond: true,
        includeHistory: true,
      });
      expect(a.shareEligible && b.shareEligible).toBe(true);

      const night = new Date('2026-06-05T00:00:00Z');
      expect(
        countDoorsUsedOnNight(
          [
            {
              id: a.id,
              roomId: a.roomId,
              shareEligible: a.shareEligible,
              shareGender: a.shareGender,
              adults: 1,
              checkInDate: a.checkInDate,
              checkOutDate: a.checkOutDate,
            },
            {
              id: b.id,
              roomId: b.roomId,
              shareEligible: b.shareEligible,
              shareGender: b.shareGender,
              adults: 1,
              checkInDate: b.checkInDate,
              checkOutDate: b.checkOutDate,
            },
          ],
          night,
          2,
        ),
      ).toBe(1);
    });

    it('8. triple maxBed=3; opposite gender / no gender / adults=2 skip', async () => {
      const m1 = stay({
        id: 'm1',
        maxBed: 3,
        checkIn: '2026-08-22T10:00:00Z',
        checkOut: '2026-08-29T08:00:00Z',
        sex: 'M',
      });
      const m2 = stay({
        id: 'm2',
        maxBed: 3,
        checkIn: '2026-08-22T10:00:00Z',
        checkOut: '2026-08-30T08:00:00Z',
        sex: 'M',
      });
      const m3 = stay({
        id: 'm3',
        maxBed: 3,
        checkIn: '2026-08-22T10:00:00Z',
        checkOut: '2026-08-31T08:00:00Z',
        sex: 'M',
      });
      const state = {
        reservations: new Map([
          [m1.id, m1],
          [m2.id, m2],
          [m3.id, m3],
        ]),
      };
      const db = makeDb(state);
      await applyElektrawebSharePair(db, { reservationId: 'm3', isSecond: true });
      expect([m1, m2, m3].every((x) => x.shareEligible)).toBe(true);
      expect(new Set([m1.shareBedIndex, m2.shareBedIndex, m3.shareBedIndex])).toEqual(
        new Set([1, 2, 3]),
      );

      const female = stay({
        id: 'f1',
        roomId: 'room-x',
        checkIn: '2026-08-22T10:00:00Z',
        checkOut: '2026-08-25T08:00:00Z',
        sex: 'F',
      });
      const male = stay({
        id: 'mx',
        roomId: 'room-x',
        checkIn: '2026-08-22T10:00:00Z',
        checkOut: '2026-08-25T08:00:00Z',
        sex: 'M',
      });
      const mixed = {
        reservations: new Map([
          [female.id, female],
          [male.id, male],
        ]),
      };
      await applyElektrawebSharePair(makeDb(mixed), {
        reservationId: 'mx',
        isSecond: true,
      });
      // Pool gender = first ordered member; opposite gender filtered out of compatible set.
      expect(male.shareEligible || female.shareEligible).toBe(true);
      expect(male.shareEligible && female.shareEligible).toBe(false);

      const noGender = stay({
        id: 'ng',
        roomId: 'room-y',
        checkIn: '2026-08-22T10:00:00Z',
        checkOut: '2026-08-25T08:00:00Z',
        sex: null,
      });
      const ngState = { reservations: new Map([[noGender.id, noGender]]) };
      const ng = await applyElektrawebSharePair(makeDb(ngState), {
        reservationId: 'ng',
        isSecond: true,
      });
      expect(ng.applied).toBe(false);
      expect(ng.skippedReason).toBe('no_gender');

      const couple = stay({
        id: 'c2',
        roomId: 'room-z',
        adults: 2,
        checkIn: '2026-08-22T10:00:00Z',
        checkOut: '2026-08-25T08:00:00Z',
        sex: 'M',
      });
      const cState = { reservations: new Map([[couple.id, couple]]) };
      const c = await applyElektrawebSharePair(makeDb(cState), {
        reservationId: 'c2',
        isSecond: true,
      });
      expect(c.applied).toBe(false);
      expect(c.skippedReason).toBe('adults_not_1');
    });

    it('9. two NORMAL with overlap and no EW S signal opens share pool (307-like)', async () => {
      const aqil = stay({
        id: 'aqil',
        roomId: 'room-307',
        checkIn: '2026-08-20T10:00:00Z',
        checkOut: '2026-08-27T08:00:00Z',
        sex: 'M',
      });
      const rovsen = stay({
        id: 'rovsen',
        roomId: 'room-307',
        checkIn: '2026-08-21T10:00:00Z',
        checkOut: '2026-08-28T08:00:00Z',
        sex: 'M',
      });
      const state = { reservations: new Map([[aqil.id, aqil], [rovsen.id, rovsen]]) };
      const db = makeDb(state);

      const result = await applyElektrawebSharePair(db, {
        reservationId: 'rovsen',
        isSecond: false,
      });

      expect(result.applied).toBe(true);
      expect(result.pairedIds.sort()).toEqual(['aqil', 'rovsen']);
      expect(aqil.shareEligible).toBe(true);
      expect(rovsen.shareEligible).toBe(true);
      expect(aqil.shareBedIndex).toBe(1);
      expect(rovsen.shareBedIndex).toBe(2);
      expect(aqil.shareGender).toBe('M');
    });

    it('10. opposite gender overlap without EW signal does not open pool', async () => {
      const male = stay({
        id: 'm',
        roomId: 'room-x',
        checkIn: '2026-08-20T10:00:00Z',
        checkOut: '2026-08-27T08:00:00Z',
        sex: 'M',
      });
      const female = stay({
        id: 'f',
        roomId: 'room-x',
        checkIn: '2026-08-21T10:00:00Z',
        checkOut: '2026-08-28T08:00:00Z',
        sex: 'F',
      });
      const state = { reservations: new Map([[male.id, male], [female.id, female]]) };
      const db = makeDb(state);

      const result = await applyElektrawebSharePair(db, {
        reservationId: 'f',
        isSecond: false,
      });

      expect(result.applied).toBe(false);
      expect(result.skippedReason).toBe('no_share_signal');
      expect(male.shareEligible).toBe(false);
      expect(female.shareEligible).toBe(false);
    });
  });
});
