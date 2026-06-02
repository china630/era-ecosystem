import { reservationFullPatchSchema } from './reservation-full-patch.schema';

describe('reservationFullPatchSchema', () => {
  it('accepts extended FO parity fields', () => {
    const parsed = reservationFullPatchSchema.parse({
      sourceId: '550e8400-e29b-41d4-a716-446655440000',
      roomCount: 2,
      rateType: 'BAR',
      guestRep: 'Rep Name',
      paidBy: 'Company',
      resNo: 'R-1001',
      useManualRate: true,
      manualDailyRate: 120.5,
      discountActive: false,
      dailyRates: [{ stayDate: '2026-06-01', amount: 100, manualFlag: true }],
      paxGuests: [
        {
          firstName: 'Ali',
          lastName: 'Mammadov',
          isPrimary: true,
        },
      ],
      notes: { RES_NOTE: 'VIP arrival' },
    });
    expect(parsed.roomCount).toBe(2);
    expect(parsed.dailyRates).toHaveLength(1);
    expect(parsed.paxGuests?.[0].firstName).toBe('Ali');
  });

  it('rejects invalid uuid for sourceId', () => {
    expect(() =>
      reservationFullPatchSchema.parse({ sourceId: 'not-uuid' }),
    ).toThrow();
  });
});
