jest.mock('@/lib/prisma', () => ({
  prisma: {
    revenueCode: { findFirst: jest.fn() },
    tourTemplate: { findMany: jest.fn(), create: jest.fn(), findUnique: jest.fn() },
    tourDeparture: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    tourBooking: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    transferOrder: { findMany: jest.fn() },
    transferVehicle: { findUnique: jest.fn() },
    reservation: { findUnique: jest.fn() },
    folioCharge: { findUnique: jest.fn() },
    folio: { findUnique: jest.fn() },
    folioPaymentAllocation: { create: jest.fn() },
  },
}));

jest.mock('@era/satellite-kit/orchestrator-gateway', () => ({
  satelliteOrganizationId: () => 'org-1',
}));

jest.mock('@/lib/services/folio.service', () => ({
  folioBalance: jest.fn(() => 0),
  postCharge: jest.fn(),
  postPayment: jest.fn(),
  voidCharge: jest.fn(),
}));

import { prisma } from '@/lib/prisma';
import { postCharge, postPayment, voidCharge, folioBalance } from '@/lib/services/folio.service';
import {
  addTourBooking,
  payTourBooking,
  removeTourBooking,
  syncTourBookingsAfterFolioSettle,
  assertVehicleSlotFree,
  TourConflictError,
} from '@/lib/services/tour.service';

const db = prisma as unknown as {
  revenueCode: { findFirst: jest.Mock };
  tourDeparture: { findUnique: jest.Mock; findMany: jest.Mock };
  tourBooking: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  transferOrder: { findMany: jest.Mock };
  transferVehicle: { findUnique: jest.Mock };
  reservation: { findUnique: jest.Mock };
  folioCharge: { findUnique: jest.Mock };
  folio: { findUnique: jest.Mock };
  folioPaymentAllocation: { create: jest.Mock };
};

describe('tour money', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.revenueCode.findFirst.mockResolvedValue({ id: 'rev-tour', code: 'TOUR' });
    db.transferOrder.findMany.mockResolvedValue([]);
    db.tourDeparture.findMany.mockResolvedValue([]);
  });

  it('refuses guests who are not IN_HOUSE', async () => {
    db.tourDeparture.findUnique.mockResolvedValue({
      id: 'd1',
      status: 'OPEN',
      capacity: 10,
      price: { toNumber: () => 80 },
      vehicle: null,
      bookings: [],
      agenda: 'Goygol',
      date: new Date('2026-08-30'),
    });
    db.reservation.findUnique.mockResolvedValue({ id: 'r1', status: 'CONFIRMED', guestId: 'g1' });
    await expect(addTourBooking({ departureId: 'd1', reservationId: 'r1' })).rejects.toThrow(
      'IN_HOUSE',
    );
    expect(postCharge).not.toHaveBeenCalled();
  });

  it('refuses a duplicate stay on the same departure', async () => {
    db.tourDeparture.findUnique.mockResolvedValue({
      id: 'd1',
      status: 'OPEN',
      capacity: 10,
      price: { toNumber: () => 80 },
      vehicle: null,
      bookings: [{ reservationId: 'r1', status: 'CHARGED' }],
    });
    db.reservation.findUnique.mockResolvedValue({
      id: 'r1',
      status: 'IN_HOUSE',
      guestId: 'g1',
      guest: {},
    });
    await expect(addTourBooking({ departureId: 'd1', reservationId: 'r1' })).rejects.toThrow(
      'already',
    );
  });

  it('posts TOUR charge when adding an in-house guest', async () => {
    db.tourDeparture.findUnique.mockResolvedValue({
      id: 'd1',
      status: 'OPEN',
      capacity: 10,
      price: { toNumber: () => 80 },
      vehicle: null,
      bookings: [],
      agenda: 'Goygol',
      date: new Date('2026-08-30'),
    });
    db.reservation.findUnique.mockResolvedValue({
      id: 'r1',
      status: 'IN_HOUSE',
      guestId: 'g1',
      guest: {},
    });
    (postCharge as jest.Mock).mockResolvedValue({ id: 'ch1' });
    db.tourBooking.create.mockResolvedValue({ id: 'b1', status: 'CHARGED' });
    await addTourBooking({ departureId: 'd1', reservationId: 'r1' });
    expect(postCharge).toHaveBeenCalledWith(
      expect.objectContaining({ reservationId: 'r1', revenueCodeId: 'rev-tour', amount: 80 }),
    );
  });

  it('voids unpaid charge on remove and blocks paid remove', async () => {
    db.tourBooking.findUnique.mockResolvedValue({
      id: 'b1',
      status: 'PAID',
      folioChargeId: 'ch1',
    });
    await expect(removeTourBooking('b1')).rejects.toThrow('paid');

    db.tourBooking.findUnique.mockResolvedValue({
      id: 'b2',
      status: 'CHARGED',
      folioChargeId: 'ch2',
    });
    db.tourBooking.update.mockResolvedValue({ id: 'b2', status: 'CANCELLED' });
    await removeTourBooking('b2');
    expect(voidCharge).toHaveBeenCalledWith('ch2');
  });

  it('allocates payment to the TOUR charge', async () => {
    db.tourBooking.findUnique.mockResolvedValue({
      id: 'b1',
      status: 'CHARGED',
      folioChargeId: 'ch1',
    });
    db.folioCharge.findUnique.mockResolvedValue({
      id: 'ch1',
      amount: { toNumber: () => 80 },
      qty: 1,
      folioId: 'f1',
      folio: { type: 'GUEST', status: 'OPEN' },
      revenueCode: { code: 'TOUR' },
    });
    (postPayment as jest.Mock).mockResolvedValue({ id: 'p1' });
    db.folioPaymentAllocation.create.mockResolvedValue({});
    db.tourBooking.findFirst.mockResolvedValue({ id: 'b1' });
    db.tourBooking.update.mockResolvedValue({});
    await payTourBooking('b1', 'CASH');
    expect(db.folioPaymentAllocation.create).toHaveBeenCalled();
    expect(db.tourBooking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PAID' }) }),
    );
  });

  it('marks ON_CITY_LEDGER when guest folio zeros without guest tender', async () => {
    db.folio.findUnique.mockResolvedValue({
      id: 'f1',
      type: 'GUEST',
      reservationId: 'r1',
      charges: [],
      payments: [],
    });
    (folioBalance as jest.Mock).mockReturnValue(0);
    db.tourBooking.updateMany.mockResolvedValue({ count: 1 });
    await syncTourBookingsAfterFolioSettle('f1', false);
    expect(db.tourBooking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'ON_CITY_LEDGER' } }),
    );
  });

  it('hard-blocks overlapping vehicle use', async () => {
    db.tourDeparture.findMany.mockResolvedValue([]);
    db.transferOrder.findMany.mockResolvedValue([
      { id: 'x1', pickupAt: new Date('2026-08-30T09:00:00Z') },
    ]);
    await expect(
      assertVehicleSlotFree({
        vehicleId: 'v1',
        from: new Date('2026-08-30T09:30:00Z'),
        to: new Date('2026-08-30T16:00:00Z'),
      }),
    ).rejects.toBeInstanceOf(TourConflictError);
  });
});
