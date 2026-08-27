jest.mock('@/lib/prisma', () => ({
  prisma: {
    reservation: { findUnique: jest.fn() },
    transferVehicle: { findUnique: jest.fn() },
    transferOrder: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn() },
    tourDeparture: { findMany: jest.fn() },
  },
}));

jest.mock('@/lib/services/folio.service', () => ({
  postCharge: jest.fn(),
}));

import { prisma } from '@/lib/prisma';
import { createTransferOrder } from '../src/lib/services/transfer.service';
import { TourConflictError } from '../src/lib/services/tour.service';

const db = prisma as unknown as {
  reservation: { findUnique: jest.Mock };
  transferVehicle: { findUnique: jest.Mock };
  transferOrder: { create: jest.Mock; findMany: jest.Mock };
  tourDeparture: { findMany: jest.Mock };
};

describe('transfer fleet overlap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.reservation.findUnique.mockResolvedValue({ id: 'r1', status: 'IN_HOUSE' });
    db.transferVehicle.findUnique.mockResolvedValue({ id: 'v1', active: true });
    db.transferOrder.findMany.mockResolvedValue([]);
    db.tourDeparture.findMany.mockResolvedValue([]);
  });

  it('blocks booking an airport transfer on a vehicle already on a tour', async () => {
    db.tourDeparture.findMany.mockResolvedValue([
      {
        id: 'd1',
        pickupAt: new Date('2026-08-30T08:00:00Z'),
        returnAt: new Date('2026-08-30T18:00:00Z'),
      },
    ]);
    await expect(
      createTransferOrder({
        reservationId: 'r1',
        direction: 'IN',
        pickupAt: new Date('2026-08-30T09:00:00Z'),
        vehicleId: 'v1',
        price: 40,
      }),
    ).rejects.toBeInstanceOf(TourConflictError);
    expect(db.transferOrder.create).not.toHaveBeenCalled();
  });
});
