import { normalizeOtaWebhookBody } from '@/lib/channel/ota-ingest.service';

describe('ota-ingest', () => {
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
});
