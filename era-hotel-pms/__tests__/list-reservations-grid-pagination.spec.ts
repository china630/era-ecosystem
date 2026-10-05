jest.mock('@/lib/prisma', () => ({
  prisma: {
    reservation: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    reservationNote: {
      findMany: jest.fn(),
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

  it('applies q to guest/room/agency/id/notes', async () => {
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
});
