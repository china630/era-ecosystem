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

  it('does not return a Prisma Request dump to the desk', async () => {
    const dump = new Error(
      'Invalid `prisma.reservation.update()` invocation:\n{ data: { audit: { request: { headers: { append: [object Function] } } } } }',
    );
    dump.name = 'PrismaClientValidationError';
    const res = handleRouteError(dump);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Could not save this stay');
    expect(body.code).toBe('STAY_SAVE_FAILED');
    expect(String(body.error)).not.toMatch(/append/);
  });

  it('maps a duplicate stay row to a code instead of the save mask', async () => {
    const err = new Error(
      'Invalid `prisma.stay.create()` invocation:\n\nUnique constraint failed on the fields: (`reservationId`)',
    );
    err.name = 'PrismaClientKnownRequestError';
    (err as Error & { code: string; meta: { target: string[] } }).code = 'P2002';
    (err as Error & { meta: { target: string[] } }).meta = { target: ['reservationId'] };
    const res = handleRouteError(err);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('STAY_RECORD_EXISTS');
    expect(body.error).not.toBe('Could not save this stay');
  });
});
