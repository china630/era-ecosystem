jest.mock('@/lib/prisma', () => ({
  prisma: {
    transferOrder: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    tourBooking: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/services/transfer.service', () => ({
  cancelTransfer: jest.fn(async (id: string) => ({ id, status: 'CANCELLED' })),
}));

jest.mock('@/lib/services/tour.service', () => ({
  assertVehicleSlotFree: jest.fn(async () => undefined),
  TRANSFER_OCCUPANCY_MS: 2 * 60 * 60 * 1000,
  TourConflictError: class TourConflictError extends Error {},
}));

import { prisma } from '@/lib/prisma';
import { cancelTransfer } from '@/lib/services/transfer.service';
import {
  assertTransferDateDecisionsOrThrow,
  assertTransferOutDecisionsOrThrow,
  cancelReservedToursOutsideStay,
  shiftPickupToDay,
  syncMobilityOnStayCancel,
} from '../src/lib/services/stay-mobility-sync.service';

const db = prisma as unknown as {
  transferOrder: { findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
  tourBooking: { findMany: jest.Mock; update: jest.Mock };
};

describe('stay mobility sync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shifts pickup to a new Baku day keeping wall-clock time', () => {
    const next = shiftPickupToDay(new Date('2026-11-20T05:00:00.000Z'), '2026-11-22');
    expect(next.toISOString()).toContain('2026-11-22');
  });

  it('cancel stay drops open transfers and RESERVED tours', async () => {
    db.transferOrder.findMany.mockResolvedValue([
      { id: 't1', status: 'BOOKED', direction: 'IN', pickupAt: new Date() },
    ]);
    db.tourBooking.findMany.mockResolvedValue([{ id: 'b1' }]);
    db.tourBooking.update.mockResolvedValue({});
    const result = await syncMobilityOnStayCancel('r1', 'Stay cancelled');
    expect(cancelTransfer).toHaveBeenCalledWith('t1', 'Stay cancelled');
    expect(result.tours.cancelledCount).toBe(1);
  });

  it('requires date-amend decisions when open transfers exist', async () => {
    db.transferOrder.findMany.mockResolvedValue([
      { id: 't1', status: 'CONFIRMED', direction: 'OUT', pickupAt: new Date() },
    ]);
    await expect(assertTransferDateDecisionsOrThrow('r1', undefined)).rejects.toMatchObject({
      code: 'TRANSFER_DATE_PENDING',
      status: 409,
    });
  });

  it('requires early-out decisions for open OUT transfers', async () => {
    db.transferOrder.findMany.mockResolvedValue([
      {
        id: 't1',
        status: 'BOOKED',
        direction: 'OUT',
        pickupAt: new Date(),
        vehicleId: null,
        flightNo: null,
      },
    ]);
    await expect(assertTransferOutDecisionsOrThrow('r1', [])).rejects.toMatchObject({
      code: 'TRANSFER_OUT_PENDING',
      status: 409,
    });
  });

  it('drops RESERVED tours on or after the new checkout day', async () => {
    db.tourBooking.findMany.mockResolvedValue([
      {
        id: 'b1',
        departure: { id: 'd1', date: new Date('2026-11-25T08:00:00.000Z'), agenda: 'A' },
      },
      {
        id: 'b2',
        departure: { id: 'd2', date: new Date('2026-11-20T08:00:00.000Z'), agenda: 'B' },
      },
    ]);
    db.tourBooking.update.mockResolvedValue({});
    const result = await cancelReservedToursOutsideStay('r1', '2026-11-22', 'Early checkout');
    expect(result.cancelledCount).toBe(1);
    expect(result.cancelledIds).toEqual(['b1']);
  });
});
