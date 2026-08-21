jest.mock('@era/satellite-kit', () => ({
  linkPersonIdentity: jest.fn(),
  getPersonOpsProfile: jest.fn().mockResolvedValue(null),
  satelliteOrganizationId: jest.fn().mockReturnValue('test-org'),
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

describe('guest-identity', () => {
  beforeEach(() => {
    jest.resetModules();
    delete process.env.ERA_HOTEL_GUEST_MDM_STRICT;
  });

  it('normalizeGuestInput omits identity columns from persist payload', async () => {
    const { normalizeGuestInput } = await import('@/lib/guest-input');
    const data = normalizeGuestInput({
      fullName: 'Ali Mammadov',
      nationality: 'AZ',
      nationalIdFin: 'ABC1234',
      passportNumber: 'AA1234567',
      phone: '+994501234567',
    });
    expect(data).toEqual({
      fullName: 'Ali Mammadov',
      nationality: 'AZ',
      phone: '+994501234567',
      voen: null,
      globalPersonId: null,
    });
    expect(data).not.toHaveProperty('nationalIdFin');
    expect(data).not.toHaveProperty('passportNumber');
  });

  it('createGuest links transient identity without persisting FIN/passport', async () => {
    const kit = jest.requireMock('@era/satellite-kit');
    kit.linkPersonIdentity.mockResolvedValue({ globalPersonId: 'person-1' });
    const { prisma } = jest.requireMock('@/lib/prisma');
    prisma.guest.create.mockResolvedValue({ id: 'g1', globalPersonId: 'person-1' });

    const { createGuest } = await import('@/lib/services/guest.service');
    await createGuest({
      fullName: 'Ali Mammadov',
      nationality: 'AZ',
      nationalIdFin: 'ABC1234',
      phone: '+994501234567',
    });

    expect(kit.linkPersonIdentity).toHaveBeenCalled();
    expect(prisma.guest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        globalPersonId: 'person-1',
        fullName: 'Ali Mammadov',
        organizationId: expect.any(String),
      }),
    });
    const createData = prisma.guest.create.mock.calls[0][0].data;
    expect(createData).not.toHaveProperty('nationalIdFin');
    expect(createData).not.toHaveProperty('passportNumber');
  });

  it('throws GuestMdmRequiredError in strict mode when MDM link missing', async () => {
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
});
