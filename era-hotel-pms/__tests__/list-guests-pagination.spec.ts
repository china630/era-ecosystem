jest.mock('@/lib/prisma', () => ({
  prisma: {
    guest: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

jest.mock('@/lib/request-organization', () => ({
  requestOrganizationId: jest.fn().mockReturnValue('test-org'),
}));

describe('listGuests pagination', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('pages without q and never dump-all', async () => {
    const { prisma } = await import('@/lib/prisma');
    (prisma.guest.findMany as jest.Mock).mockResolvedValue([
      { id: 'g1', documents: [] },
      { id: 'g2', documents: [] },
    ]);
    (prisma.guest.count as jest.Mock).mockResolvedValue(40);

    const { listGuests } = await import('@/lib/services/guest.service');
    const result = await listGuests({ page: 1, pageSize: 25 });

    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(40);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(25);
    expect(prisma.guest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 25,
        orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
      }),
    );
    expect(prisma.guest.count).toHaveBeenCalled();
  });

  it('page 2 uses skip and returns disjoint window', async () => {
    const { prisma } = await import('@/lib/prisma');
    (prisma.guest.findMany as jest.Mock).mockResolvedValue([{ id: 'g26', documents: [] }]);
    (prisma.guest.count as jest.Mock).mockResolvedValue(40);

    const { listGuests } = await import('@/lib/services/guest.service');
    const result = await listGuests({ page: 2, pageSize: 25 });

    expect(result.items.map((g) => g.id)).toEqual(['g26']);
    expect(prisma.guest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 25, take: 25 }),
    );
  });

  it('applies q filter in where', async () => {
    const { prisma } = await import('@/lib/prisma');
    (prisma.guest.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.guest.count as jest.Mock).mockResolvedValue(0);

    const { listGuests } = await import('@/lib/services/guest.service');
    await listGuests({ q: 'Ali', page: 1, pageSize: 25 });

    expect(prisma.guest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.any(Array),
        }),
        select: expect.objectContaining({
          documents: expect.any(Object),
        }),
      }),
    );
  });

  it('applies gender and fin filters', async () => {
    const { prisma } = await import('@/lib/prisma');
    (prisma.guest.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.guest.count as jest.Mock).mockResolvedValue(0);

    const { listGuests } = await import('@/lib/services/guest.service');
    await listGuests({ gender: 'M', fin: 'ABC1234', page: 1, pageSize: 25 });

    expect(prisma.guest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { sex: 'M' },
            {
              documents: {
                some: {
                  docType: { in: expect.arrayContaining(['ID_CARD']) },
                  docNumber: { contains: 'ABC1234', mode: 'insensitive' },
                },
              },
            },
          ],
        },
      }),
    );
  });
});
