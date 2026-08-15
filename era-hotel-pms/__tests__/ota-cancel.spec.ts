import { handleOtaCancel } from '@/lib/services/channel.service';

const findUnique = jest.fn();
const update = jest.fn();
const findMany = jest.fn();
const resolveUpdate = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    reservation: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      update: (...args: unknown[]) => update(...args),
      findFirst: jest.fn(),
    },
    channelSyncError: {
      findMany: (...args: unknown[]) => findMany(...args),
      update: (...args: unknown[]) => resolveUpdate(...args),
    },
  },
}));

describe('handleOtaCancel', () => {
  beforeEach(() => {
    findUnique.mockReset();
    update.mockReset();
    findMany.mockReset();
    resolveUpdate.mockReset();
    findMany.mockResolvedValue([]);
  });

  it('cancels by externalRef and fails when missing (no latest-OTA fallback)', async () => {
    findUnique.mockResolvedValueOnce(null);
    await expect(handleOtaCancel({ externalRef: 'missing' })).rejects.toThrow(
      /not found/i,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('cancels by reservationId when present', async () => {
    findUnique.mockResolvedValueOnce({
      id: 'res-9',
      externalRef: 'ota-9',
    });
    update.mockResolvedValueOnce({ id: 'res-9', status: 'CANCELLED' });

    const result = await handleOtaCancel({ reservationId: '00000000-0000-4000-8000-000000000009' });
    expect(result.cancelled).toBe(true);
    expect(result.reservationId).toBe('res-9');
    expect(update).toHaveBeenCalledWith({
      where: { id: 'res-9' },
      data: { status: 'CANCELLED' },
    });
  });

  it('requires externalRef or reservationId', async () => {
    await expect(handleOtaCancel({})).rejects.toThrow(/required/i);
  });
});
