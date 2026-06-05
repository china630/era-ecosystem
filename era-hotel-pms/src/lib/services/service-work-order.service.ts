import type { ServiceCadence, ServicePriority, ServiceRequestSource } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export async function listServiceRequests(status?: string) {
  return prisma.maintenanceWorkOrder.findMany({
    where: status ? { status: status as never } : undefined,
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 200,
    include: { room: { select: { id: true, roomNumber: true } } },
  });
}

export async function createServiceRequest(input: {
  title: string;
  description?: string;
  category?: string;
  priority?: ServicePriority;
  source?: ServiceRequestSource;
  roomId?: string;
  location?: string;
  reportedBy?: string;
}) {
  return prisma.maintenanceWorkOrder.create({
    data: {
      title: input.title,
      description: input.description,
      category: input.category,
      priority: input.priority ?? 'NORMAL',
      source: input.source ?? 'STAFF',
      roomId: input.roomId,
      location: input.location,
      reportedBy: input.reportedBy,
      status: 'OPEN',
    },
    include: { room: { select: { id: true, roomNumber: true } } },
  });
}

export async function updateServiceRequestStatus(
  id: string,
  status: 'IN_PROGRESS' | 'DONE' | 'CANCELLED',
) {
  return prisma.maintenanceWorkOrder.update({
    where: { id },
    data: {
      status,
      completedAt: status === 'DONE' ? new Date() : null,
    },
    include: { room: { select: { id: true, roomNumber: true } } },
  });
}

function addCadence(base: Date, cadence: ServiceCadence): Date {
  const d = new Date(base);
  switch (cadence) {
    case 'DAILY':
      d.setDate(d.getDate() + 1);
      break;
    case 'WEEKLY':
      d.setDate(d.getDate() + 7);
      break;
    case 'MONTHLY':
      d.setMonth(d.getMonth() + 1);
      break;
    case 'QUARTERLY':
      d.setMonth(d.getMonth() + 3);
      break;
    case 'YEARLY':
      d.setFullYear(d.getFullYear() + 1);
      break;
    default:
      d.setDate(d.getDate() + 1);
  }
  return d;
}

export async function runDueRecurringSchedules() {
  const due = await prisma.recurringServiceSchedule.findMany({
    where: { enabled: true, nextDueAt: { lte: new Date() } },
    take: 50,
  });
  const created = [];
  for (const row of due) {
    const wo = await createServiceRequest({
      title: row.title,
      category: row.category ?? undefined,
      source: 'RECURRING',
      roomId: row.roomId ?? undefined,
      location: row.location ?? undefined,
      reportedBy: 'recurring-scheduler',
    });
    created.push(wo);
    await prisma.recurringServiceSchedule.update({
      where: { id: row.id },
      data: {
        lastRunAt: new Date(),
        nextDueAt: addCadence(row.nextDueAt, row.cadence),
      },
    });
  }
  return created;
}
