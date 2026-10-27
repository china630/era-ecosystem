jest.mock('@/lib/prisma', () => ({
  prisma: {
    reservation: { findUnique: jest.fn() },
    folio: { findMany: jest.fn() },
  },
}));

jest.mock('@/lib/services/folio-transfer.service', () => ({
  transferFolioCharge: jest.fn(),
  transferFolioPayment: jest.fn(),
}));

import { prisma } from '@/lib/prisma';
import {
  transferFolioCharge,
  transferFolioPayment,
} from '@/lib/services/folio-transfer.service';
import { transferOpenGuestChargesToPayer } from '@/lib/services/checkout-move-payer.service';

describe('transferOpenGuestChargesToPayer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects when stay has no company or agency', async () => {
    (prisma.reservation.findUnique as jest.Mock).mockResolvedValue({
      companyId: null,
      agencyId: null,
    });
    await expect(
      transferOpenGuestChargesToPayer({ reservationId: 'r1' }),
    ).rejects.toMatchObject({ code: 'NO_PAYER_ON_STAY' });
  });

  it('prefers company and transfers guest charges and payments', async () => {
    (prisma.reservation.findUnique as jest.Mock).mockResolvedValue({
      companyId: 'c1',
      agencyId: 'a1',
    });
    (prisma.folio.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'gf1',
        charges: [{ id: 'ch1', serviceReceivedAt: null }],
        payments: [{ id: 'p1', voidedAt: null }],
      },
    ]);
    (transferFolioCharge as jest.Mock).mockResolvedValue({ folioId: 'cf1' });
    (transferFolioPayment as jest.Mock).mockResolvedValue({ folioId: 'cf1' });

    const result = await transferOpenGuestChargesToPayer({ reservationId: 'r1' });
    expect(result).toEqual({
      payerType: 'COMPANY',
      transferredCharges: 1,
      transferredPayments: 1,
    });
    expect(transferFolioCharge).toHaveBeenCalledWith(
      expect.objectContaining({ chargeId: 'ch1', targetFolioType: 'COMPANY' }),
    );
    expect(transferFolioPayment).toHaveBeenCalledWith(
      expect.objectContaining({ paymentId: 'p1', targetFolioType: 'COMPANY' }),
    );
  });

  it('falls back to agency when company is absent', async () => {
    (prisma.reservation.findUnique as jest.Mock).mockResolvedValue({
      companyId: null,
      agencyId: 'a1',
    });
    (prisma.folio.findMany as jest.Mock).mockResolvedValue([
      { id: 'gf1', charges: [{ id: 'ch1', serviceReceivedAt: null }], payments: [] },
    ]);
    (transferFolioCharge as jest.Mock).mockResolvedValue({ folioId: 'af1' });

    const result = await transferOpenGuestChargesToPayer({ reservationId: 'r1' });
    expect(result.payerType).toBe('AGENCY');
    expect(transferFolioCharge).toHaveBeenCalledWith(
      expect.objectContaining({ targetFolioType: 'AGENCY' }),
    );
  });
});
