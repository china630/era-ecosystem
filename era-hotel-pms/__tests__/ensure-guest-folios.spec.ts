import { ensurePrimaryAndGuestFolios } from '@/lib/services/booking-folio.service';

jest.mock('@/lib/request-organization', () => ({
  requestOrganizationId: () => 'org-1',
}));

const reservationGuestFindMany = jest.fn();
const reservationGuestFindFirst = jest.fn();
const reservationGuestUpdateMany = jest.fn();
const reservationGuestUpdate = jest.fn();
const reservationUpdate = jest.fn();
const folioFindFirst = jest.fn();
const folioFindMany = jest.fn();
const folioCreate = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    reservationGuest: {
      findMany: (...args: unknown[]) => reservationGuestFindMany(...args),
      findFirst: (...args: unknown[]) => reservationGuestFindFirst(...args),
      updateMany: (...args: unknown[]) => reservationGuestUpdateMany(...args),
      update: (...args: unknown[]) => reservationGuestUpdate(...args),
    },
    reservation: {
      update: (...args: unknown[]) => reservationUpdate(...args),
    },
    folio: {
      findFirst: (...args: unknown[]) => folioFindFirst(...args),
      findMany: (...args: unknown[]) => folioFindMany(...args),
      create: (...args: unknown[]) => folioCreate(...args),
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
  },
}));

const live = {
  id: 'pax-live',
  isPrimary: true,
  departedAt: null,
  sortOrder: 0,
};
const departed = {
  id: 'pax-departed',
  isPrimary: false,
  departedAt: new Date('2026-10-26T15:07:00.000Z'),
  sortOrder: 1,
};

describe('ensurePrimaryAndGuestFolios', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    reservationGuestUpdateMany.mockResolvedValue({ count: 1 });
    reservationGuestUpdate.mockResolvedValue(live);
    reservationUpdate.mockResolvedValue({});
    folioCreate.mockResolvedValue({ id: 'folio-new', status: 'OPEN' });
    reservationGuestFindFirst.mockResolvedValue({ id: live.id });
    folioFindMany.mockResolvedValue([]);
    reservationGuestFindMany.mockImplementation(
      async (args: { where?: { departedAt?: null } }) => {
        if (args.where && 'departedAt' in args.where) return [{ id: live.id }];
        return [live, departed];
      },
    );
  });

  it('creates an open folio only for a live guest who has none', async () => {
    folioFindFirst.mockResolvedValue(null);

    await ensurePrimaryAndGuestFolios('stay-1');

    expect(folioCreate).toHaveBeenCalledTimes(1);
    expect(folioCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reservationId: 'stay-1',
        reservationGuestId: 'pax-live',
        type: 'GUEST',
        status: 'OPEN',
      }),
    });
    expect(reservationGuestUpdateMany).toHaveBeenCalledWith({
      where: {
        reservationId: 'stay-1',
        OR: [{ departedAt: { not: null } }, { guestState: 'DEPARTED' }],
      },
      data: { ownsFolio: false, isPrimary: false },
    });
  });

  it('does not create a second folio when the live guest already has a closed one', async () => {
    folioFindFirst.mockResolvedValue({
      id: 'folio-closed',
      reservationGuestId: 'pax-live',
      status: 'CLOSED',
    });

    await ensurePrimaryAndGuestFolios('stay-1');

    expect(folioCreate).not.toHaveBeenCalled();
    const partyQuery = reservationGuestFindMany.mock.calls.find(
      (call) => call[0]?.where?.departedAt === null,
    );
    expect(partyQuery?.[0].where).toEqual(
      expect.objectContaining({ departedAt: null, ownsFolio: true }),
    );
  });

  it('does not look up a folio for a departed guest', async () => {
    folioFindFirst.mockResolvedValue(null);

    await ensurePrimaryAndGuestFolios('stay-1');

    const lookedUp = folioFindFirst.mock.calls
      .map((call) => call[0].where.reservationGuestId)
      .filter((id: unknown) => id != null);
    // Party ensure + foldLooseGuestFolioOntoPrimary both resolve the live primary.
    expect(lookedUp.every((id: string) => id === 'pax-live')).toBe(true);
    expect(lookedUp).not.toContain('pax-departed');
  });
});
