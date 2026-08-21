jest.mock('@era/satellite-kit', () => ({
  resolvePersonIdentity: jest.fn().mockResolvedValue({ globalPersonId: 'mdm-person-1' }),
}));

describe('guests import adapter', () => {
  it('upsert resolve-only — no identity columns in prisma data', async () => {
    const { guestsAdapter } = await import('@/lib/import/adapters/guests.adapter');
    const tx = {
      guest: {
        findFirst: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
    };

    await guestsAdapter.upsert(
      tx as never,
      {
        externalRef: 'EW-1',
        firstName: 'Ali',
        lastName: 'Mammadov',
        fullName: 'Ali Mammadov',
        title: null,
        gender: 'M',
        birthDate: null,
        passportNumber: 'AA1234567',
        nationalIdFin: 'ABC1234',
        nationality: 'AZ',
        phone: '+994501234567',
        email: null,
        vipType: null,
        greyList: false,
        gdprConfirmed: false,
        visitCount: 0,
        vehiclePlate: null,
      },
      false,
    );

    const upsertArg = tx.guest.upsert.mock.calls[0][0];
    expect(upsertArg.create.globalPersonId).toBe('mdm-person-1');
    expect(upsertArg.create).not.toHaveProperty('nationalIdFin');
    expect(upsertArg.create).not.toHaveProperty('passportNumber');
    expect(upsertArg.update).not.toHaveProperty('nationalIdFin');
    expect(upsertArg.update).not.toHaveProperty('passportNumber');
  });
});
