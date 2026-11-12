import { prisma } from "@/lib/prisma";
import type { LeadStage, Prisma } from "@prisma/client";

export async function listLeads(opts: {
  where?: Prisma.LeadWhereInput;
  orderBy: Prisma.LeadOrderByWithRelationInput;
  take?: number;
}) {
  return prisma.lead.findMany({
    where: opts.where,
    include: {
      owner: { select: { id: true, fullName: true, login: true } },
      visits: true,
    },
    orderBy: opts.orderBy,
    take: opts.take ?? 100,
  });
}

export async function createLead(
  data: Parameters<typeof prisma.lead.create>[0]["data"],
) {
  return prisma.lead.create({ data });
}

export async function findLeadById(id: string) {
  return prisma.lead.findUnique({ where: { id } });
}

export async function findLeadDetailById(id: string) {
  return prisma.lead.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, fullName: true, login: true } },
      visits: { orderBy: { visitedAt: "desc" } },
      stageHistory: { orderBy: { changedAt: "desc" } },
      importBatch: { select: { id: true, fileName: true, createdAt: true } },
    },
  });
}

export async function updateLead(id: string, data: Prisma.LeadUpdateInput) {
  return prisma.lead.update({ where: { id }, data });
}

export async function findLeadWithVisits(id: string) {
  return prisma.lead.findUnique({
    where: { id },
    include: { visits: true },
  });
}

export async function updateLeadScore(
  id: string,
  score: number,
) {
  return prisma.lead.update({
    where: { id },
    data: { score, scoreUpdatedAt: new Date() },
    include: { owner: { select: { id: true, fullName: true } } },
  });
}

export async function updateLeadStage(
  id: string,
  stage: LeadStage,
  fromStage: LeadStage,
) {
  const updated = await prisma.lead.update({
    where: { id },
    data: { stage },
  });
  await prisma.leadStageHistory.create({
    data: { leadId: id, fromStage, toStage: stage },
  });
  return updated;
}

export async function assignLeadOwner(
  id: string,
  ownerId: string | null,
) {
  return prisma.lead.update({
    where: { id },
    data: { ownerId },
    include: {
      owner: { select: { id: true, fullName: true, login: true } },
    },
  });
}

export async function findUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

export async function convertLeadWon(
  id: string,
  fromStage: LeadStage,
  data: { counterpartyId?: string | null },
) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.lead.update({
      where: { id },
      data: {
        stage: "WON",
        convertedAt: new Date(),
        counterpartyId: data.counterpartyId,
      },
    });
    await tx.leadStageHistory.create({
      data: {
        leadId: id,
        fromStage,
        toStage: "WON",
      },
    });
    return updated;
  });
}
