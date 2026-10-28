jest.mock('@/lib/prisma', () => ({
  prisma: {
    cashShift: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/request-organization', () => ({
  requestOrganizationId: jest.fn(() => 'org-1'),
}));

jest.mock('@/lib/auth/session', () => ({
  getSatelliteSession: jest.fn(async () => ({ email: 'cashier@hotel.local', login: 'cashier' })),
}));

const resolveDefaultDevicesForSatellite = jest.fn(() => ({
  fiscalDeviceId: 'kkm-1',
  bankTerminalId: 'pos-1',
}));
const assertLiveFiscalReady = jest.fn();

jest.mock('@era/satellite-kit', () => ({
  resolveDefaultDevicesForSatellite: (...args: unknown[]) => resolveDefaultDevicesForSatellite(...args),
  assertLiveFiscalReady: (...args: unknown[]) => assertLiveFiscalReady(...args),
}));

import { prisma } from '@/lib/prisma';
import {
  closeOpenCashShift,
  ensureOpenCashShift,
  openCashShiftExplicit,
} from '@/lib/services/cash-shift.service';

describe('ensureOpenCashShift', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.ERA_FISCAL_LIVE;
  });

  it('returns an existing primary OPEN shift', async () => {
    const open = { id: 's1', status: 'OPEN', isPrimary: true, registerId: 'FO-01' };
    (prisma.cashShift.findFirst as jest.Mock).mockResolvedValueOnce(open);

    await expect(ensureOpenCashShift()).resolves.toEqual(open);
    expect(prisma.cashShift.create).not.toHaveBeenCalled();
  });

  it('creates a primary OPEN shift when none exists', async () => {
    (prisma.cashShift.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    const created = {
      id: 's2',
      status: 'OPEN',
      isPrimary: true,
      cashier: 'cashier@hotel.local',
      registerId: 'FO-01',
      fiscalDeviceId: 'kkm-1',
      bankTerminalId: 'pos-1',
    };
    (prisma.cashShift.create as jest.Mock).mockResolvedValue(created);

    await expect(ensureOpenCashShift()).resolves.toEqual(created);
    expect(prisma.cashShift.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org-1',
        cashier: 'cashier@hotel.local',
        registerId: 'FO-01',
        isPrimary: true,
        status: 'OPEN',
        fiscalDeviceId: 'kkm-1',
        bankTerminalId: 'pos-1',
      }),
    });
  });

  it('reuses a raced OPEN shift when create fails', async () => {
    const raced = { id: 's3', status: 'OPEN', isPrimary: true, registerId: 'FO-01' };
    (prisma.cashShift.findFirst as jest.Mock)
      .mockResolvedValueOnce(null) // primary
      .mockResolvedValueOnce(null) // any
      .mockResolvedValueOnce(raced); // primary after race
    (prisma.cashShift.create as jest.Mock).mockRejectedValue(new Error('unique'));

    await expect(ensureOpenCashShift({ registerId: 'FO-02' })).resolves.toEqual(raced);
  });

  it('openCashShiftExplicit refuses a second OPEN shift', async () => {
    (prisma.cashShift.findFirst as jest.Mock).mockResolvedValueOnce({ id: 's1' });
    await expect(
      openCashShiftExplicit({ cashier: 'a', registerId: 'FO-01' }),
    ).rejects.toThrow('A cash shift is already open');
  });

  it('closeOpenCashShift closes the OPEN row', async () => {
    (prisma.cashShift.findFirst as jest.Mock).mockResolvedValueOnce({ id: 's1', status: 'OPEN' });
    (prisma.cashShift.update as jest.Mock).mockResolvedValue({ id: 's1', status: 'CLOSED' });
    await expect(closeOpenCashShift()).resolves.toMatchObject({ status: 'CLOSED' });
    expect(prisma.cashShift.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 's1' },
        data: expect.objectContaining({ status: 'CLOSED' }),
      }),
    );
  });
});
