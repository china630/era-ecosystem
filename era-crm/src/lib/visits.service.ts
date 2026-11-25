import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function listVisitsRecent(
  limit = 100,
  where?: Prisma.VisitWhereInput,
) {
  return prisma.visit.findMany({
    where,
    include: { lead: true },
    orderBy: { visitedAt: "desc" },
    take: limit,
  });
}

export async function findLeadById(id: string, organizationId?: string) {
  return prisma.lead.findFirst({
    where: organizationId ? { id, organizationId } : { id },
  });
}

export async function createVisit(data: {
  organizationId: string;
  leadId: string;
  notes?: string;
  addressLabel?: string;
  latitude?: number;
  longitude?: number;
  visitedAt: Date;
}) {
  return prisma.visit.create({
    data: {
      organizationId: data.organizationId,
      leadId: data.leadId,
      notes: data.notes,
      addressLabel: data.addressLabel,
      latitude: data.latitude,
      longitude: data.longitude,
      visitedAt: data.visitedAt,
    },
    include: { lead: { include: { owner: true } } },
  });
}
