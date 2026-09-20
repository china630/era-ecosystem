import { normalizeOtaWebhookBody, upsertOtaReservation } from '@/lib/channel/ota-ingest.service';

const findUnique = jest.fn();
const update = jest.fn();
const logSyncError = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    reservation: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      findFirst: (...args: unknown[]) => findUnique(...args),
      update: (...args: unknown[]) => update(...args),
      create: jest.fn(),
    },
    guest: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    channel: { findFirst: jest.fn() },
    roomType: { findFirst: jest.fn() },
    ratePlan: { findFirst: jest.fn() },
    bookingSource: { findFirst: jest.fn(), create: jest.fn() },
  },
}));

jest.mock('@/lib/services/channel.service', () => ({
  logSyncError: (...args: unknown[]) => logSyncError(...args),
}));

describe('ota-ingest', () => {
  beforeEach(() => {
    findUnique.mockReset();
    update.mockReset();
    logSyncError.mockReset();
  });

  it('normalizes cancel event', () => {
    const payload = normalizeOtaWebhookBody('booking', {
      event: 'cancel',
      externalReservationId: 'ota-123',
      payload: { guest: { fullName: 'Test Guest' } },
    });
    expect(payload.event).toBe('cancel');
    expect(payload.externalReservationId).toBe('ota-123');
    expect(payload.channelCode).toBe('booking');
  });

  it('normalizes modify event', () => {
    const payload = normalizeOtaWebhookBody('expedia', {
      event: 'reservation_modify',
      externalReservationId: 'exp-99',
      payload: {
        guest: { fullName: 'Modify Guest' },
        checkInDate: '2026-08-01',
        checkOutDate: '2026-08-05',
        otaRoomCode: 'DLX',
        totalAmount: 400,
      },
    });
    expect(payload.event).toBe('modify');
    expect(payload.checkOutDate).toBe('2026-08-05');
    expect(payload.totalAmount).toBe(400);
  });

  it('normalizes create with defaults', () => {
    const payload = normalizeOtaWebhookBody('booking', {
      event: 'create',
      externalReservationId: 'new-1',
      payload: {
        guest: { name: 'Walk OTA' },
        checkInDate: '2026-07-10',
        checkOutDate: '2026-07-12',
      },
    });
    expect(payload.event).toBe('create');
    expect(payload.guest.fullName).toBe('Walk OTA');
    expect(payload.otaRoomCode).toBe('STD');
  });

  it('cancel path cancels by externalRef only when found', async () => {
    findUnique.mockResolvedValueOnce({ id: 'res-1', externalRef: 'ota-123' });
    update.mockResolvedValueOnce({ id: 'res-1', status: 'CANCELLED' });

    const result = await upsertOtaReservation({
      externalReservationId: 'ota-123',
      event: 'cancel',
      channelCode: 'booking',
      guest: { fullName: 'X' },
      checkInDate: '2026-08-01',
      checkOutDate: '2026-08-02',
      otaRoomCode: 'STD',
    });

    expect(findUnique).toHaveBeenCalledWith({ where: { externalRef: 'ota-123' } });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'res-1' },
      data: { status: 'CANCELLED' },
    });
    expect(result).toEqual({ action: 'cancelled', reservationId: 'res-1' });
    expect(logSyncError).not.toHaveBeenCalled();
  });

  it('cancel path logs sync error and does not invent a reservation when missing', async () => {
    findUnique.mockResolvedValueOnce(null);

    const result = await upsertOtaReservation({
      externalReservationId: 'missing-ref',
      event: 'cancel',
      channelCode: 'booking',
      guest: { fullName: 'X' },
      checkInDate: '2026-08-01',
      checkOutDate: '2026-08-02',
      otaRoomCode: 'STD',
    });

    expect(result).toEqual({ action: 'cancel_missing' });
    expect(update).not.toHaveBeenCalled();
    expect(logSyncError).toHaveBeenCalledWith({
      otaReference: 'missing-ref',
      errorMessage: 'Cancel received for unknown OTA reservation',
    });
  });

  it('refuses Channex ingest when room_type_id is unmapped (no first-room fallback)', async () => {
    const { prisma } = await import('@/lib/prisma');
    (prisma.channel.findFirst as jest.Mock).mockResolvedValueOnce({
      roomMappings: [],
    });

    await expect(
      upsertOtaReservation({
        externalReservationId: 'chnx-1',
        event: 'create',
        channelCode: 'CHANNEX',
        guest: { fullName: 'Guest' },
        checkInDate: '2026-09-21',
        checkOutDate: '2026-09-22',
        otaRoomCode: '994d1375-dbbd-4072-8724-b2ab32ce781b',
        otaRateCode: '445835fb-7956-42ac-9efc-3e6f331f0808',
      }),
    ).rejects.toThrow(/Unmapped Channex room_type_id/);
  });
});
