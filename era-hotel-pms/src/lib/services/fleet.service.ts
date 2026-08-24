import { prisma } from '@/lib/prisma';
import { satelliteOrganizationId } from '@era/satellite-kit/orchestrator-gateway';
import { TourConflictError } from '@/lib/services/tour.service';

function orgId() {
  return satelliteOrganizationId();
}

export async function listFleetVehicles(activeOnly = false) {
  return prisma.transferVehicle.findMany({
    where: activeOnly ? { active: true } : undefined,
    orderBy: { code: 'asc' },
  });
}

export async function createFleetVehicle(input: {
  code: string;
  brand: string;
  licensePlate: string;
  driverName?: string;
  driverPhone?: string;
  maxSeats: number;
}) {
  return prisma.transferVehicle.create({
    data: {
      organizationId: orgId(),
      code: input.code,
      brand: input.brand,
      licensePlate: input.licensePlate,
      driverName: input.driverName,
      driverPhone: input.driverPhone,
      maxSeats: input.maxSeats,
      active: true,
    },
  });
}

export async function updateFleetVehicle(
  id: string,
  patch: {
    brand?: string;
    licensePlate?: string;
    driverName?: string | null;
    driverPhone?: string | null;
    maxSeats?: number;
    active?: boolean;
  },
) {
  const current = await prisma.transferVehicle.findUnique({ where: { id } });
  if (!current) throw new Error('Vehicle not found');
  if (patch.active === false) {
    const openTours = await prisma.tourDeparture.count({
      where: { vehicleId: id, status: { in: ['DRAFT', 'OPEN', 'CLOSED'] } },
    });
    const openXfer = await prisma.transferOrder.count({
      where: { vehicleId: id, status: { in: ['BOOKED', 'CONFIRMED'] } },
    });
    if (openTours + openXfer > 0) {
      throw new TourConflictError('Cannot retire a vehicle assigned to open tours or transfers');
    }
  }
  return prisma.transferVehicle.update({ where: { id }, data: patch });
}
