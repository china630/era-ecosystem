import { prisma } from '@/lib/prisma';
import type { DispatchRequestStatus } from '@prisma/client';

export async function listDispatchVehicles() {
  return prisma.dispatchVehicle.findMany({ where: { active: true }, orderBy: { code: 'asc' } });
}

export async function listDispatchRequests(status?: DispatchRequestStatus) {
  return prisma.dispatchRequest.findMany({
    where: status ? { status } : undefined,
    include: { vehicle: true, guest: { select: { fullName: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createDispatchRequest(input: {
  guestId?: string;
  fromLabel: string;
  toLabel: string;
  notes?: string;
}) {
  return prisma.dispatchRequest.create({ data: input });
}

export async function assignDispatchRequest(id: string, vehicleId: string) {
  return prisma.dispatchRequest.update({
    where: { id },
    data: { vehicleId, status: 'ASSIGNED' },
  });
}

export async function completeDispatchRequest(id: string) {
  return prisma.dispatchRequest.update({
    where: { id },
    data: { status: 'DONE', completedAt: new Date() },
  });
}

export async function createDispatchVehicle(input: { code: string; name: string; capacity?: number }) {
  return prisma.dispatchVehicle.create({ data: input });
}
