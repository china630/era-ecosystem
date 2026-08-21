jest.mock('@/lib/prisma', () => ({
  prisma: {
    reservation: { findUnique: jest.fn() },
    folio: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    salesContract: { findMany: jest.fn() },
    folioPayment: { findUnique: jest.fn(), aggregate: jest.fn() },
    folioDeposit: { findMany: jest.fn() },
    revenueCode: { findUnique: jest.fn(), create: jest.fn() },
  },
}));

jest.mock('@/lib/services/sales-contract.service', () => ({
  findActiveSalesContract: jest.fn(),
}));

jest.mock('@/lib/services/guest-dedup.service', () => ({
  resolveCreditLimitAzn: jest.fn(),
}));

jest.mock('@/lib/services/folio.service', () => {
  const actual = jest.requireActual('@/lib/services/folio.service') as Record<string, unknown>;
  return {
    ...actual,
    folioBalance: jest.fn(
      (
        charges: Array<{ amount: unknown }>,
        payments: Array<{ amount: unknown; kind?: string }>,
      ) => {
        const c = charges.reduce((s, x) => s + Number(x.amount), 0);
        const p = payments.reduce((s, x) => {
          const n = Number(x.amount);
          return s + (x.kind === 'REFUND' ? -n : n);
        }, 0);
        return c - p;
      },
    ),
    postPayment: jest.fn(),
    postCharge: jest.fn(),
  };
});

jest.mock('@/lib/services/folio-deposit.service', () => ({
  applyHeldDepositsToFolio: jest.fn(),
}));

jest.mock('@/lib/services/card-auth.service', () => ({
  captureAuthorization: jest.fn(),
}));

jest.mock('@/lib/services/hotel-policy.service', () => ({
  getHotelPolicy: jest.fn(async () => ({
    cityLedgerMissingCounterparty: 'DEFER_HANDOFF',
  })),
}));

describe('P5 FO money negative paths (AC-HOT-CASH)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
      text: async () => '',
    }) as unknown as typeof fetch;
  });

  it('rejects City Ledger transfer without ACTIVE sales contract', async () => {
    const { prisma } = jest.requireMock('@/lib/prisma');
    const sales = jest.requireMock('@/lib/services/sales-contract.service');
    sales.findActiveSalesContract.mockResolvedValue(null);
    prisma.reservation.findUnique.mockResolvedValue({
      id: 'r1',
      agencyId: null,
      salesContractId: null,
      checkInDate: new Date('2026-08-01'),
      agency: null,
      salesContract: null,
    });
    prisma.folio.findUnique.mockResolvedValue({
      id: 'f1',
      reservationId: 'r1',
      type: 'COMPANY',
    });

    const { assertCanTransferToCityLedger } = await import(
      '@/lib/services/city-ledger-gate.service'
    );
    await expect(assertCanTransferToCityLedger('r1', 'f1', 100)).rejects.toThrow(
      /ACTIVE sales contract/,
    );
  });

  it('rejects City Ledger transfer when credit limit exceeded', async () => {
    const { prisma } = jest.requireMock('@/lib/prisma');
    const sales = jest.requireMock('@/lib/services/sales-contract.service');
    const dedup = jest.requireMock('@/lib/services/guest-dedup.service');
    sales.findActiveSalesContract.mockResolvedValue({ id: 'c1' });
    dedup.resolveCreditLimitAzn.mockResolvedValue(50);
    prisma.reservation.findUnique.mockResolvedValue({
      id: 'r1',
      agencyId: 'a1',
      salesContractId: 'c1',
      checkInDate: new Date('2026-08-01'),
      agency: { creditLimitAzn: null, voen: '1234567890', financeCounterpartyId: 'cp-1' },
      salesContract: { id: 'c1' },
    });
    prisma.folio.findUnique.mockResolvedValue({
      id: 'f1',
      reservationId: 'r1',
      type: 'AGENCY',
    });
    prisma.folio.findMany.mockResolvedValue([{ charges: [{ amount: 40 }], payments: [] }]);

    const { assertCanTransferToCityLedger } = await import(
      '@/lib/services/city-ledger-gate.service'
    );
    await expect(assertCanTransferToCityLedger('r1', 'f1', 20)).rejects.toThrow(
      /Credit limit exceeded/,
    );
  });

  it('rejects GUEST folio transfer to City Ledger', async () => {
    const { prisma } = jest.requireMock('@/lib/prisma');
    prisma.reservation.findUnique.mockResolvedValue({
      id: 'r1',
      agencyId: null,
      salesContractId: 'c1',
      checkInDate: new Date('2026-08-01'),
      agency: null,
      salesContract: null,
    });
    prisma.folio.findUnique.mockResolvedValue({
      id: 'f1',
      reservationId: 'r1',
      type: 'GUEST',
    });
    const { assertCanTransferToCityLedger } = await import(
      '@/lib/services/city-ledger-gate.service'
    );
    await expect(assertCanTransferToCityLedger('r1', 'f1', 10)).rejects.toThrow(
      /COMPANY or AGENCY/,
    );
  });

  it('assertGuestFoliosZeroBalance fails on outstanding guest balance', async () => {
    const { prisma } = jest.requireMock('@/lib/prisma');
    const amt = (n: number) => ({ toNumber: () => n });
    prisma.folio.findMany.mockResolvedValue([
      {
        id: 'fg',
        type: 'GUEST',
        status: 'OPEN',
        charges: [{ amount: amt(80), qty: 1 }],
        payments: [],
      },
      {
        id: 'fc',
        type: 'COMPANY',
        status: 'OPEN',
        charges: [{ amount: amt(200), qty: 1 }],
        payments: [],
      },
    ]);
    const folioMod = jest.requireActual('@/lib/services/folio.service') as {
      assertGuestFoliosZeroBalance: (id: string) => Promise<void>;
    };
    await expect(folioMod.assertGuestFoliosZeroBalance('r1')).rejects.toThrow(
      /Outstanding guest folio balance/,
    );
  });

  it('blocks refund on TRANSFERRED_AR folio', async () => {
    const { prisma } = jest.requireMock('@/lib/prisma');
    prisma.folioPayment.findUnique.mockResolvedValue({
      id: 'p1',
      kind: 'PAYMENT',
      amount: 50,
      paymentMethod: 'CASH',
      folioId: 'f1',
      folio: { id: 'f1', status: 'TRANSFERRED_AR' },
    });
    const { refundFolioPayment } = await import('@/lib/services/folio-refund.service');
    await expect(refundFolioPayment({ paymentId: 'p1' })).rejects.toThrow(/TRANSFERRED_AR/);
  });

  it('blocks refund of a refund payment', async () => {
    const { prisma } = jest.requireMock('@/lib/prisma');
    prisma.folioPayment.findUnique.mockResolvedValue({
      id: 'p2',
      kind: 'REFUND',
      amount: 10,
      paymentMethod: 'CASH',
      folioId: 'f1',
      folio: { id: 'f1', status: 'OPEN' },
    });
    const { refundFolioPayment } = await import('@/lib/services/folio-refund.service');
    await expect(refundFolioPayment({ paymentId: 'p2' })).rejects.toThrow(
      /Cannot refund a refund/,
    );
  });

  it('refuses DEPOSIT settle lines exceeding HELD total', async () => {
    const { prisma } = jest.requireMock('@/lib/prisma');
    prisma.folio.findUnique.mockResolvedValue({
      id: 'f1',
      reservationId: 'r1',
      status: 'OPEN',
      charges: [{ amount: 100 }],
      payments: [],
      reservation: { guest: {} },
    });
    prisma.folioDeposit.findMany.mockResolvedValue([{ id: 'd1', amount: 20 }]);
    const { settleFolio } = await import('@/lib/services/folio-settlement.service');
    await expect(
      settleFolio({
        folioId: 'f1',
        lines: [{ method: 'DEPOSIT', amount: 50 }],
      }),
    ).rejects.toThrow(/exceeds HELD deposits/);
  });

  it('postDiscount rejects non-positive amount', async () => {
    const { postDiscount } = await import('@/lib/services/folio.service');
    await expect(
      postDiscount({ reservationId: 'r1', amount: 0, description: 'x' }),
    ).rejects.toThrow(/positive/);
  });
});
