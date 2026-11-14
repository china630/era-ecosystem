jest.mock('@/lib/prisma', () => ({
  prisma: {
    reservation: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    reservationNote: {
      findMany: jest.fn(),
    },
    transferOrder: { findMany: jest.fn().mockResolvedValue([]) },
    laundryTicket: { findMany: jest.fn().mockResolvedValue([]) },
    hotelProfile: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    businessDay: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
  },
}));

describe('listReservationsForGrid pagination', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('defaults to LIVE statuses and pages without take:500', async () => {
    const { prisma } = await import('@/lib/prisma');
    const ranked = Array.from({ length: 30 }, (_, i) => ({
      id: `r${String(i).padStart(2, '0')}`,
      checkInDate: new Date('2099-01-01T00:00:00.000Z'),
    }));
    (prisma.reservation.findMany as jest.Mock).mockImplementation((args: { select?: unknown }) =>
      Promise.resolve(args.select ? ranked : []),
    );

    const { listReservationsForGrid } = await import(
      '@/lib/services/reservation-full.service'
    );
    const result = await listReservationsForGrid({ page: 1, pageSize: 25 });

    const rankQuery = (prisma.reservation.findMany as jest.Mock).mock.calls[0][0];
    expect(rankQuery.take).not.toBe(500);
    expect(rankQuery.where).toEqual(
      expect.objectContaining({
        groupId: null,
        status: { in: ['OPTION', 'CONFIRMED', 'IN_HOUSE'] },
      }),
    );
    expect(result.total).toBe(30);
    expect(result.page).toBe(1);
    const pageQuery = (prisma.reservation.findMany as jest.Mock).mock.calls[1][0];
    expect(pageQuery.where.id.in).toHaveLength(25);
  });

  it('guestId without status defaults to ALL (history deep link)', async () => {
    const { prisma } = await import('@/lib/prisma');
    (prisma.reservation.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.reservation.count as jest.Mock).mockResolvedValue(0);

    const { listReservationsForGrid } = await import(
      '@/lib/services/reservation-full.service'
    );
    await listReservationsForGrid({ guestId: 'guest-1', page: 1, pageSize: 25 });

    const where = (prisma.reservation.findMany as jest.Mock).mock.calls[0][0]
      .where;
    expect(where.guestId).toBe('guest-1');
    expect(where.status).toBeUndefined();
  });

  it('ALL does not restrict status; hasNotes and guestId apply', async () => {
    const { prisma } = await import('@/lib/prisma');
    (prisma.reservation.findMany as jest.Mock).mockResolvedValue([
      { id: 'r1', checkInDate: new Date('2099-01-01T00:00:00.000Z') },
      { id: 'r2', checkInDate: new Date('2099-01-02T00:00:00.000Z') },
    ]);
    (prisma.reservationNote.findMany as jest.Mock).mockResolvedValue([
      { reservationId: 'r1', text: 'note one' },
      { reservationId: 'r2', text: 'note two' },
    ]);

    const { listReservationsForGrid } = await import(
      '@/lib/services/reservation-full.service'
    );
    const result = await listReservationsForGrid({
      status: 'ALL',
      hasNotes: true,
      guestId: 'guest-1',
      page: 2,
      pageSize: 25,
    });

    expect(result.total).toBe(2);
    expect(result.items).toEqual([]);
    expect(result.page).toBe(2);
    expect(prisma.reservationNote.findMany).toHaveBeenCalled();
    const where = (prisma.reservation.findMany as jest.Mock).mock.calls[0][0]
      .where;
    expect(where.status).toBeUndefined();
    expect(where.guestId).toBe('guest-1');
    expect(where.id).toEqual({ in: ['r1', 'r2'] });
    expect((prisma.reservation.findMany as jest.Mock).mock.calls[0][0].take).not.toBe(500);
  });

  it('sort=rowNo is ignored and ranks like the default room sort', async () => {
    const { prisma } = await import('@/lib/prisma');
    const future = new Date('2099-01-01T00:00:00.000Z');
    const ranked = [
      {
        id: 'aaa',
        checkInDate: future,
        room: { roomNumber: '202', status: 'CLEAN' },
        roomType: { code: 'SGL' },
        guest: { fullName: 'Zed' },
        agency: null,
        company: null,
        source: null,
        notes: [],
        adults: 1,
        status: 'CONFIRMED',
      },
      {
        id: 'zzz',
        checkInDate: future,
        room: { roomNumber: '101', status: 'CLEAN' },
        roomType: { code: 'SGL' },
        guest: { fullName: 'Ann' },
        agency: null,
        company: null,
        source: null,
        notes: [],
        adults: 1,
        status: 'CONFIRMED',
      },
    ];
    (prisma.reservation.findMany as jest.Mock).mockImplementation(
      (args: { select?: unknown; where?: { id?: { in?: string[] } } }) => {
        if (args.select) return Promise.resolve(ranked);
        const ids = args.where?.id?.in ?? [];
        return Promise.resolve(
          ranked
            .filter((row) => ids.includes(row.id))
            .map((row) => ({ ...row, paxGuests: [], notes: [] })),
        );
      },
    );

    const { listReservationsForGrid } = await import(
      '@/lib/services/reservation-full.service'
    );
    const result = await listReservationsForGrid({
      page: 1,
      pageSize: 25,
      sort: 'rowNo',
      dir: 'asc',
    });

    expect(result.items.map((row) => row.id)).toEqual(['zzz', 'aaa']);
  });

  it('hasNotes with no note rows returns empty page', async () => {
    const { prisma } = await import('@/lib/prisma');
    (prisma.reservationNote.findMany as jest.Mock).mockResolvedValue([]);

    const { listReservationsForGrid } = await import(
      '@/lib/services/reservation-full.service'
    );
    const result = await listReservationsForGrid({ hasNotes: true });

    expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 25 });
    expect(prisma.reservation.findMany).not.toHaveBeenCalled();
  });

  it('applies q to guest/room/agency/company/id/notes', async () => {
    const { prisma } = await import('@/lib/prisma');
    (prisma.reservation.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.reservation.count as jest.Mock).mockResolvedValue(0);

    const { listReservationsForGrid } = await import(
      '@/lib/services/reservation-full.service'
    );
    await listReservationsForGrid({ q: 'Ali', status: 'LIVE' });

    const where = (prisma.reservation.findMany as jest.Mock).mock.calls[0][0]
      .where;
    expect(where.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          notes: { some: { text: { contains: 'Ali', mode: 'insensitive' } } },
        }),
        expect.objectContaining({
          company: { name: { contains: 'Ali', mode: 'insensitive' } },
        }),
        expect.objectContaining({
          company: { code: { contains: 'Ali', mode: 'insensitive' } },
        }),
      ]),
    );
  });

  it('noteQ matches note text (trim) and returns empty when none', async () => {
    const { prisma } = await import('@/lib/prisma');
    (prisma.reservationNote.findMany as jest.Mock).mockResolvedValue([
      { reservationId: 'r1', text: '  Extra pillow  ' },
      { reservationId: 'r2', text: '   ' },
    ]);

    const { listReservationsForGrid } = await import(
      '@/lib/services/reservation-full.service'
    );
    const empty = await listReservationsForGrid({ noteQ: 'late checkout' });
    expect(empty).toEqual({ items: [], total: 0, page: 1, pageSize: 25 });
    expect(prisma.reservation.findMany).not.toHaveBeenCalled();

    (prisma.reservation.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.reservation.count as jest.Mock).mockResolvedValue(0);
    await listReservationsForGrid({ noteQ: 'pillow' });
    const where = (prisma.reservation.findMany as jest.Mock).mock.calls[0][0]
      .where;
    expect(where.id).toEqual({ in: ['r1'] });
  });

  it('exposes stay business stamps and sorts departure by stamp when present', async () => {
    const { prisma } = await import('@/lib/prisma');
    const ranked = [
      {
        id: 'late-out',
        checkInDate: new Date('2026-11-01T00:00:00.000Z'),
        checkOutDate: new Date('2026-11-13T00:00:00.000Z'),
        stay: {
          checkInBusinessDate: new Date('2026-11-01T00:00:00.000Z'),
          checkOutBusinessDate: new Date('2026-11-14T00:00:00.000Z'),
        },
        room: { roomNumber: '203', status: 'DIRTY', hkCondition: 'DIRTY' },
        roomType: { code: 'SDBL' },
        guest: { fullName: 'Late Out' },
        agency: null,
        company: null,
        source: null,
        notes: [],
        adults: 1,
        status: 'CHECKED_OUT',
        paxGuests: [],
      },
      {
        id: 'on-plan',
        checkInDate: new Date('2026-11-10T00:00:00.000Z'),
        checkOutDate: new Date('2026-11-13T00:00:00.000Z'),
        stay: {
          checkInBusinessDate: new Date('2026-11-10T00:00:00.000Z'),
          checkOutBusinessDate: new Date('2026-11-13T00:00:00.000Z'),
        },
        room: { roomNumber: '101', status: 'DIRTY', hkCondition: 'DIRTY' },
        roomType: { code: 'SDBL' },
        guest: { fullName: 'On Plan' },
        agency: null,
        company: null,
        source: null,
        notes: [],
        adults: 1,
        status: 'CHECKED_OUT',
        paxGuests: [],
      },
    ];
    (prisma.reservation.findMany as jest.Mock).mockImplementation(
      (args: { select?: unknown; where?: { id?: { in?: string[] } } }) => {
        if (args.select) return Promise.resolve(ranked);
        const ids = args.where?.id?.in ?? [];
        return Promise.resolve(ranked.filter((row) => ids.includes(row.id)));
      },
    );

    const { listReservationsForGrid } = await import(
      '@/lib/services/reservation-full.service'
    );
    const result = await listReservationsForGrid({
      page: 1,
      pageSize: 25,
      sort: 'departure',
      dir: 'asc',
      status: 'ALL',
    });

    expect(result.items.map((row) => row.id)).toEqual(['on-plan', 'late-out']);
    expect(result.items[0]?.checkOutBusinessDate).toBe('2026-11-13T00:00:00.000Z');
    expect(result.items[1]?.checkOutBusinessDate).toBe('2026-11-14T00:00:00.000Z');
    const rankSelect = (prisma.reservation.findMany as jest.Mock).mock.calls[0][0].select;
    expect(rankSelect.stay).toEqual({
      select: { checkInBusinessDate: true, checkOutBusinessDate: true },
    });
  });
});
