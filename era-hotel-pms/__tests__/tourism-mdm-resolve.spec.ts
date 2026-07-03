jest.mock('@era/satellite-kit', () => ({
  resolveIdentifierForCompliance: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    reservation: {
      findUniqueOrThrow: jest.fn(),
    },
    tourismSubmission: {
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/services/hotel.service', () => ({
  getPropertyCode: jest.fn().mockResolvedValue('NAFTA'),
}));

jest.mock('@/lib/compliance/tourism-adapter', () => ({
  getTourismAdapter: jest.fn().mockReturnValue({
    submitCheckIn: jest.fn().mockResolvedValue({ ok: true }),
    submitCheckOut: jest.fn().mockResolvedValue({ ok: true }),
  }),
}));

describe('tourism MDM resolve', () => {
  it('builds payload passport from MDM compliance resolve', async () => {
    const kit = jest.requireMock('@era/satellite-kit');
    kit.resolveIdentifierForCompliance.mockResolvedValue({
      globalPersonId: 'person-1',
      fin: 'ABC1234',
      passportNumber: 'AA9998888',
      issuingCountry: 'AZ',
      accessDenied: false,
    });

    const { prisma } = jest.requireMock('@/lib/prisma');
    prisma.reservation.findUniqueOrThrow.mockResolvedValue({
      checkInDate: new Date('2026-06-01'),
      checkOutDate: new Date('2026-06-05'),
      guest: { fullName: 'Ali', globalPersonId: 'person-1' },
      room: { roomNumber: '101', roomType: { code: 'STD' } },
      roomType: { code: 'STD' },
    });
    prisma.tourismSubmission.create.mockResolvedValue({ id: 'sub-1' });
    prisma.tourismSubmission.update.mockImplementation(({ data }) => ({ id: 'sub-1', ...data }));

    const { submitTourismCheckIn } = await import('@/lib/services/tourism.service');
    await submitTourismCheckIn('res-1');

    expect(kit.resolveIdentifierForCompliance).toHaveBeenCalledWith('person-1');
    const createArg = prisma.tourismSubmission.create.mock.calls[0][0];
    const payload = JSON.parse(createArg.data.payloadJson);
    expect(payload.passportNumber).toBe('AA9998888');
  });
});
