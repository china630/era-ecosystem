import { prisma } from "@/lib/prisma";

export async function listInboxThreadsRecent(limit = 100) {
  return prisma.inboxThread.findMany({
    include: {
      lead: { select: { id: true, title: true, contactRef: true } },
    },
    orderBy: { lastMessageAt: "desc" },
    take: limit,
  });
}

export async function findLeadById(id: string) {
  return prisma.lead.findUnique({ where: { id } });
}

export async function createInboxThread(data: {
  channel: string;
  externalRef: string;
  leadId?: string;
  preview?: string;
  lastMessageAt: Date;
}) {
  return prisma.inboxThread.create({
    data: {
      channel: data.channel,
      externalRef: data.externalRef,
      leadId: data.leadId,
      preview: data.preview,
      lastMessageAt: data.lastMessageAt,
    },
    include: {
      lead: { select: { id: true, title: true, contactRef: true } },
    },
  });
}
