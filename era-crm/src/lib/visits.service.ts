import { prisma } from "@/lib/prisma";

export async function listVisitsRecent(limit = 100) {
  return prisma.visit.findMany({
    include: { lead: true },
    orderBy: { visitedAt: "desc" },
    take: limit,
  });
}

export async function findLeadById(id: string) {
  return prisma.lead.findUnique({ where: { id } });
}

export async function createVisit(data: {
  leadId: string;
  notes?: string;
  addressLabel?: string;
  latitude?: number;
  longitude?: number;
  visitedAt: Date;
}) {
  return prisma.visit.create({
    data: {
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
