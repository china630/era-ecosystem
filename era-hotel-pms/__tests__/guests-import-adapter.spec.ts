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
        middleName: null,
        fullName: 'Ali Mammadov',
        title: null,
        sex: 'M',
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
    const { resolvePersonIdentity } = jest.requireMock('@era/satellite-kit');
    expect(resolvePersonIdentity).toHaveBeenCalledWith(
      expect.objectContaining({
        sex: 'M',
        fin: 'ABC1234',
        passport: 'AA1234567',
      }),
    );
    expect(upsertArg.update).not.toHaveProperty('nationalIdFin');
    expect(upsertArg.update).not.toHaveProperty('passportNumber');
  });

  it('mapRow classifies documents and orders given + patronymic + surname', async () => {
    const { guestsAdapter } = await import('@/lib/import/adapters/guests.adapter');
    const row = guestsAdapter.mapRow({
      externalRef: '1',
      firstName: 'Ali Vali',
      lastName: 'Mammadov',
      nationalIdFin: 'AA1234567',
      passportNumber: null,
      nationality: 'Azerbaijan',
      birthDate: '2001-01-01',
    });
    expect(row.nationalIdFin).toBeNull();
    expect(row.passportNumber).toBe('AA1234567');
    expect(row.firstName).toBe('Ali');
    expect(row.middleName).toBe('Vali');
    expect(row.fullName).toBe('Ali Vali Mammadov');
    expect(row.nationality).toBe('AZ');
  });

  it('mapRow maps Elektraweb Gender 0/1 to M/F', async () => {
    const { guestsAdapter } = await import('@/lib/import/adapters/guests.adapter');
    expect(
      guestsAdapter.mapRow({
        externalRef: '10',
        firstName: 'Zaur',
        lastName: 'Rasulov',
        gender: 0,
        nationality: 'Azerbaijan',
      }).sex,
    ).toBe('M');
    expect(
      guestsAdapter.mapRow({
        externalRef: '11',
        firstName: 'Aygun',
        lastName: 'Aliyeva',
        gender: '1 - Female',
        nationality: 'Azerbaijan',
      }).sex,
    ).toBe('F');
  });
});
