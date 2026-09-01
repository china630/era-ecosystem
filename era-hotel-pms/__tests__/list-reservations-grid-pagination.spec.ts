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
    (prisma.reservation.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.reservation.count as jest.Mock).mockResolvedValue(0);

    const { listReservationsForGrid } = await import(
      '@/lib/services/reservation-full.service'
    );
    await listReservationsForGrid({ page: 1, pageSize: 25 });

    expect(prisma.reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 25,
        where: expect.objectContaining({
          groupId: null,
          status: { in: ['OPTION', 'CONFIRMED', 'IN_HOUSE'] },
        }),
      }),
    );
    expect(prisma.reservation.count).toHaveBeenCalled();
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
    (prisma.reservation.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.reservation.count as jest.Mock).mockResolvedValue(3);
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

    expect(result.total).toBe(3);
    expect(result.page).toBe(2);
    expect(prisma.reservationNote.findMany).toHaveBeenCalled();
    const where = (prisma.reservation.findMany as jest.Mock).mock.calls[0][0]
      .where;
    expect(where.status).toBeUndefined();
    expect(where.guestId).toBe('guest-1');
    expect(where.id).toEqual({ in: ['r1', 'r2'] });
    expect(prisma.reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 25, take: 25 }),
    );
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

  it('applies q to guest/room/agency/id', async () => {
    const { prisma } = await import('@/lib/prisma');
    (prisma.reservation.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.reservation.count as jest.Mock).mockResolvedValue(0);

    const { listReservationsForGrid } = await import(
      '@/lib/services/reservation-full.service'
    );
    await listReservationsForGrid({ q: 'Ali', status: 'LIVE' });

    const where = (prisma.reservation.findMany as jest.Mock).mock.calls[0][0]
      .where;
    expect(where.OR).toEqual(expect.any(Array));
  });
});
