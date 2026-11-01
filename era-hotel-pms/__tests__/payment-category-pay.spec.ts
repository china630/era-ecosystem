import {
  pocketNetMoney,
  stayCategoryMoneyPair,
} from '@/lib/folio-money-pair';
import {
  defaultPaymentCategoryForRole,
  isPaymentCategory,
  resolvePaymentCategory,
} from '@/lib/payment-category';

describe('payment category money (AC-HOT-CASH negatives)', () => {
  it('rejects unknown paymentCategory tokens', () => {
    expect(isPaymentCategory('LODGING')).toBe(true);
    expect(isPaymentCategory('ROOM')).toBe(false);
    expect(isPaymentCategory('')).toBe(false);
  });

  it('maps PROCEDURE role to CLINIC by default and keeps an explicit override', () => {
    expect(defaultPaymentCategoryForRole('PROCEDURE')).toBe('CLINIC');
    expect(defaultPaymentCategoryForRole('ROOM')).toBe('LODGING');
    expect(
      resolvePaymentCategory({
        paymentCategory: 'OTHER',
        systemRole: 'PROCEDURE',
      }),
    ).toBe('OTHER');
  });

  it('keeps lodging credit off clinic debt', () => {
    const charges = [
      {
        amount: 200,
        qty: 1,
        paymentCategory: 'CLINIC',
        revenueCode: { paymentCategory: 'CLINIC', systemRole: 'PROCEDURE' },
      },
      {
        amount: 100,
        qty: 1,
        paymentCategory: 'LODGING',
        revenueCode: { paymentCategory: 'LODGING', systemRole: 'ROOM' },
      },
    ];
    const payments = [
      {
        id: 'p-lodge',
        amount: 300,
        kind: 'PAYMENT',
        paymentCategory: 'LODGING',
        revenueCode: { paymentCategory: 'LODGING', systemRole: 'ROOM' },
      },
    ];
    expect(stayCategoryMoneyPair(charges, payments, 'CLINIC')).toEqual({
      debt: 200,
      unused: 0,
    });
    expect(stayCategoryMoneyPair(charges, payments, 'LODGING')).toEqual({
      debt: 0,
      unused: 200,
    });
  });

  it('a category refund shrinks only that category unused', () => {
    const charges = [
      {
        amount: 100,
        qty: 1,
        paymentCategory: 'CLINIC',
        revenueCode: { paymentCategory: 'CLINIC' },
      },
    ];
    const payments = [
      {
        id: 'p1',
        amount: 250,
        kind: 'PAYMENT',
        paymentCategory: 'CLINIC',
        revenueCode: { paymentCategory: 'CLINIC' },
      },
      {
        id: 'r1',
        amount: 50,
        kind: 'REFUND',
        refundOfPaymentId: 'p1',
        paymentCategory: 'CLINIC',
        revenueCode: { paymentCategory: 'CLINIC' },
      },
    ];
    expect(stayCategoryMoneyPair(charges, payments, 'CLINIC')).toEqual({
      debt: 0,
      unused: 100,
    });
  });

  it('checkout pocket rollup nets categories inside one pocket (lodging pay can settle clinic)', () => {
    const pair = pocketNetMoney(
      [
        { amount: 200, qty: 1, paymentCategory: 'CLINIC' },
        { amount: 100, qty: 1, paymentCategory: 'LODGING' },
      ],
      [{ id: 'p', amount: 300, kind: 'PAYMENT', paymentCategory: 'LODGING' }],
    );
    expect(pair).toMatchObject({ debt: 0, unused: 0 });
    // Mid-stay pay/refund still see the category split:
    expect(
      stayCategoryMoneyPair(
        [
          { amount: 200, qty: 1, paymentCategory: 'CLINIC' },
          { amount: 100, qty: 1, paymentCategory: 'LODGING' },
        ],
        [{ id: 'p', amount: 300, kind: 'PAYMENT', paymentCategory: 'LODGING' }],
        'CLINIC',
      ).debt,
    ).toBe(200);
  });
});

jest.mock('@/lib/request-organization', () => ({
  requestOrganizationId: () => 'org-1',
}));

const folioFindUnique = jest.fn();
const folioFindFirst = jest.fn();
const folioFindMany = jest.fn();
const folioPaymentAggregate = jest.fn();
const reservationGuestFindFirst = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    folio: {
      findUnique: (...args: unknown[]) => folioFindUnique(...args),
      findFirst: (...args: unknown[]) => folioFindFirst(...args),
      findMany: (...args: unknown[]) => folioFindMany(...args),
    },
    folioPayment: {
      aggregate: (...args: unknown[]) => folioPaymentAggregate(...args),
    },
    reservationGuest: {
      findFirst: (...args: unknown[]) => reservationGuestFindFirst(...args),
    },
  },
}));

const refundFolioPayment = jest.fn();

jest.mock('@/lib/services/folio-refund.service', () => ({
  refundFolioPayment: (...args: unknown[]) => refundFolioPayment(...args),
}));

describe('refundStayCategoryCredit negatives', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    reservationGuestFindFirst.mockResolvedValue({ id: 'guest-1' });
    folioFindFirst.mockResolvedValue({ id: 'folio-1', status: 'OPEN' });
    folioFindMany.mockResolvedValue([]);
  });

  it('refuses an unknown category', async () => {
    const { refundStayCategoryCredit } = await import('@/lib/services/booking-folio.service');
    await expect(
      refundStayCategoryCredit({
        reservationId: '11111111-1111-1111-1111-111111111111',
        paymentCategory: 'ROOM' as 'LODGING',
        amount: 10,
        reason: 'test',
      }),
    ).rejects.toThrow(/PAYMENT_CATEGORY_REQUIRED/);
  });

  it('refuses a blank refund reason', async () => {
    const { refundStayCategoryCredit } = await import('@/lib/services/booking-folio.service');
    await expect(
      refundStayCategoryCredit({
        reservationId: '11111111-1111-1111-1111-111111111111',
        paymentCategory: 'CLINIC',
        amount: 10,
        reason: '   ',
        reservationGuestId: 'guest-1',
      }),
    ).rejects.toMatchObject({ code: 'REFUND_REASON_REQUIRED' });
  });

  it('refuses when the category has no unused credit', async () => {
    folioFindUnique.mockResolvedValue({
      id: 'folio-1',
      status: 'OPEN',
      charges: [
        {
          amount: 100,
          qty: 1,
          paymentCategory: 'CLINIC',
          revenueCode: { paymentCategory: 'CLINIC' },
        },
      ],
      payments: [
        {
          id: 'p1',
          amount: 100,
          kind: 'PAYMENT',
          voidedAt: null,
          paymentCategory: 'CLINIC',
          createdAt: new Date('2026-11-01T10:00:00Z'),
          revenueCode: { paymentCategory: 'CLINIC' },
        },
      ],
    });

    const { refundStayCategoryCredit } = await import('@/lib/services/booking-folio.service');
    await expect(
      refundStayCategoryCredit({
        reservationId: '11111111-1111-1111-1111-111111111111',
        paymentCategory: 'CLINIC',
        amount: 10,
        reason: 'return',
        reservationGuestId: 'guest-1',
      }),
    ).rejects.toMatchObject({ code: 'PAYMENT_CATEGORY_NO_UNUSED' });
    expect(refundFolioPayment).not.toHaveBeenCalled();
  });

  it('refuses a refund larger than category unused (lodging credit cannot fund clinic)', async () => {
    folioFindUnique.mockResolvedValue({
      id: 'folio-1',
      status: 'OPEN',
      charges: [
        {
          amount: 50,
          qty: 1,
          paymentCategory: 'CLINIC',
          revenueCode: { paymentCategory: 'CLINIC' },
        },
      ],
      payments: [
        {
          id: 'p-clinic',
          amount: 80,
          kind: 'PAYMENT',
          voidedAt: null,
          paymentCategory: 'CLINIC',
          createdAt: new Date('2026-11-01T10:00:00Z'),
          revenueCode: { paymentCategory: 'CLINIC' },
        },
        {
          id: 'p-lodge',
          amount: 500,
          kind: 'PAYMENT',
          voidedAt: null,
          paymentCategory: 'LODGING',
          createdAt: new Date('2026-11-01T09:00:00Z'),
          revenueCode: { paymentCategory: 'LODGING' },
        },
      ],
    });

    const { refundStayCategoryCredit } = await import('@/lib/services/booking-folio.service');
    // Clinic unused = 30; ask for 40 → exceeds even though lodging has 500 credit.
    await expect(
      refundStayCategoryCredit({
        reservationId: '11111111-1111-1111-1111-111111111111',
        paymentCategory: 'CLINIC',
        amount: 40,
        reason: 'return',
        reservationGuestId: 'guest-1',
      }),
    ).rejects.toMatchObject({ code: 'PAYMENT_CATEGORY_REFUND_EXCEEDS' });
    expect(refundFolioPayment).not.toHaveBeenCalled();
  });

  it('posts FIFO refunds only against the chosen category', async () => {
    folioFindUnique.mockResolvedValue({
      id: 'folio-1',
      status: 'OPEN',
      charges: [],
      payments: [
        {
          id: 'p-old',
          amount: 20,
          kind: 'PAYMENT',
          voidedAt: null,
          paymentCategory: 'CLINIC',
          createdAt: new Date('2026-11-01T08:00:00Z'),
          revenueCode: { paymentCategory: 'CLINIC' },
        },
        {
          id: 'p-new',
          amount: 50,
          kind: 'PAYMENT',
          voidedAt: null,
          paymentCategory: 'CLINIC',
          createdAt: new Date('2026-11-01T09:00:00Z'),
          revenueCode: { paymentCategory: 'CLINIC' },
        },
        {
          id: 'p-lodge',
          amount: 100,
          kind: 'PAYMENT',
          voidedAt: null,
          paymentCategory: 'LODGING',
          createdAt: new Date('2026-11-01T07:00:00Z'),
          revenueCode: { paymentCategory: 'LODGING' },
        },
      ],
    });
    folioPaymentAggregate.mockResolvedValue({ _sum: { amount: null } });
    refundFolioPayment.mockImplementation(async (input: { paymentId: string; amount: number }) => ({
      id: `refund-${input.paymentId}`,
      amount: input.amount,
    }));

    const { refundStayCategoryCredit } = await import('@/lib/services/booking-folio.service');
    const rows = await refundStayCategoryCredit({
      reservationId: '11111111-1111-1111-1111-111111111111',
      paymentCategory: 'CLINIC',
      amount: 35,
      reason: 'mid-stay return',
      paymentMethod: 'CASH',
      reservationGuestId: 'guest-1',
    });

    expect(refundFolioPayment).toHaveBeenCalledTimes(2);
    expect(refundFolioPayment.mock.calls[0]![0]).toMatchObject({
      paymentId: 'p-old',
      amount: 20,
    });
    expect(refundFolioPayment.mock.calls[1]![0]).toMatchObject({
      paymentId: 'p-new',
      amount: 15,
    });
    expect(rows).toHaveLength(2);
  });
});
