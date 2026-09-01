import { handleRouteError } from '@/lib/api-utils';

describe('handleRouteError share / room conflicts', () => {
  it('maps room conflict to 409', async () => {
    const res = handleRouteError(
      new Error('Room conflict: overlapping stay (2026-08-20 – 2026-08-27)'),
    );
    expect(res.status).toBe(409);
  });

  it('maps share pool full to 409', async () => {
    const res = handleRouteError(new Error('Share pool on this room is full'));
    expect(res.status).toBe(409);
  });

  it('maps opposite gender to 409', async () => {
    const res = handleRouteError(new Error('Opposite gender cannot share this room'));
    expect(res.status).toBe(409);
  });

  it('maps OTA share reject to 400 (cannot)', async () => {
    const res = handleRouteError(new Error('OTA reservations cannot use shared twin assignment'));
    expect(res.status).toBe(400);
  });
});
