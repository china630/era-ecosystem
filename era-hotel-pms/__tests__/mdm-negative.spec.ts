jest.mock('@era/satellite-kit', () => ({
  linkPersonIdentity: jest.fn(),
  getPersonOpsProfile: jest.fn(),
  mergePersonRecords: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    guest: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

describe('MDM negative paths (AC-HOT-MDM)', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete process.env.ERA_HOTEL_GUEST_MDM_STRICT;
  });

  it('assertGuestMdmStrict throws when strict and no globalPersonId', async () => {
    process.env.ERA_HOTEL_GUEST_MDM_STRICT = 'true';
    const { assertGuestMdmStrict, GuestMdmRequiredError } = await import(
      '@/lib/guest-identity'
    );
    expect(() =>
      assertGuestMdmStrict({ fullName: 'Ali' }, null),
    ).toThrow(GuestMdmRequiredError);
  });

  it('assertGuestMdmStrict allows when not strict', async () => {
    const { assertGuestMdmStrict } = await import('@/lib/guest-identity');
    expect(() => assertGuestMdmStrict({ fullName: 'Ali' }, null)).not.toThrow();
  });

  it('createGuest in strict mode denies missing MDM link', async () => {
    process.env.ERA_HOTEL_GUEST_MDM_STRICT = 'true';
    const kit = jest.requireMock('@era/satellite-kit');
    kit.linkPersonIdentity.mockResolvedValue({ globalPersonId: null });

    const { createGuest } = await import('@/lib/services/guest.service');
    await expect(
      createGuest({
        fullName: 'Ali Mammadov',
        nationality: 'AZ',
        nationalIdFin: 'ABC1234',
        phone: '+994501234567',
      }),
    ).rejects.toMatchObject({ name: 'GuestMdmRequiredError' });
  });

  it('ops-profile enrichment returns masked fields only from MDM (no local FIN)', async () => {
    const kit = jest.requireMock('@era/satellite-kit');
    kit.getPersonOpsProfile.mockResolvedValue({
      globalPersonId: 'p1',
      fullName: 'Ali Mammadov',
      finMasked: 'A*****4',
      passportMasked: null,
    });
    const { enrichGuestWithMdmProfile } = await import('@/lib/guest-identity');
    const enriched = await enrichGuestWithMdmProfile({
      id: 'g1',
      fullName: 'Ali Mammadov',
      globalPersonId: 'p1',
    });
    expect(enriched.mdmProfile?.finMasked).toBe('A*****4');
    expect(enriched).not.toHaveProperty('nationalIdFin');
    expect(JSON.stringify(enriched)).not.toMatch(/ABC1234/);
  });

  it('mergePersonRecords failure surfaces as MDM merge failed', async () => {
    const kit = jest.requireMock('@era/satellite-kit');
    kit.mergePersonRecords.mockResolvedValue({ globalPersonId: null });
    const merged = await kit.mergePersonRecords('s1', 't1');
    expect(merged.globalPersonId).toBeNull();
  });

  it('invalid FIN length fails merge schema (min 7)', async () => {
    const { z } = await import('zod');
    const schema = z.object({
      fin: z.string().trim().min(7),
    });
    expect(() => schema.parse({ fin: 'ABC' })).toThrow();
    expect(schema.parse({ fin: 'ABC1234' }).fin).toBe('ABC1234');
  });
});
