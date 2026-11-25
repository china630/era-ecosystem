/**
 * Unsorted inbound queue (CRM-UNSORT-01 / P0-2): Accept / Link / Reject.
 */
import { prisma } from "@/lib/prisma";

export async function listUnsortedLeads(organizationId: string, take = 100) {
  return prisma.lead.findMany({
    where: { organizationId, isUnsorted: true },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      title: true,
      contactRef: true,
      contactPhone: true,
      channel: true,
      sourceRef: true,
      stage: true,
      createdAt: true,
      ownerId: true,
    },
  });
}

/** Accept: claim ownership and leave the unsorted queue. */
export async function acceptUnsortedLead(input: {
  organizationId: string;
  leadId: string;
  actorUserId: string;
}) {
  const lead = await prisma.lead.findFirst({
    where: {
      id: input.leadId,
      organizationId: input.organizationId,
      isUnsorted: true,
    },
  });
  if (!lead) return null;
  const updated = await prisma.lead.update({
    where: { id: lead.id },
    data: {
      isUnsorted: false,
      ownerId: input.actorUserId,
      stage: lead.stage === "NEW" ? "CONTACTED" : lead.stage,
    },
  });
  await prisma.activity.create({
    data: {
      organizationId: input.organizationId,
      leadId: lead.id,
      type: "SYSTEM",
      authorId: input.actorUserId,
      payloadJson: JSON.stringify({ action: "unsorted.accept" }),
    },
  });
  return updated;
}

/**
 * Link: reattach conversations/calls/messages to an existing lead, then close the draft.
 */
export async function linkUnsortedLead(input: {
  organizationId: string;
  leadId: string;
  targetLeadId: string;
  actorUserId: string;
}) {
  if (input.leadId === input.targetLeadId) {
    throw new Error("Cannot link a lead to itself");
  }
  const [source, target] = await Promise.all([
    prisma.lead.findFirst({
      where: {
        id: input.leadId,
        organizationId: input.organizationId,
        isUnsorted: true,
      },
    }),
    prisma.lead.findFirst({
      where: { id: input.targetLeadId, organizationId: input.organizationId },
    }),
  ]);
  if (!source || !target) return null;

  await prisma.$transaction(async (tx) => {
    await tx.conversation.updateMany({
      where: { organizationId: input.organizationId, leadId: source.id },
      data: { leadId: target.id },
    });
    await tx.call.updateMany({
      where: { organizationId: input.organizationId, leadId: source.id },
      data: { leadId: target.id },
    });
    await tx.task.updateMany({
      where: { organizationId: input.organizationId, leadId: source.id },
      data: { leadId: target.id },
    });
    await tx.activity.updateMany({
      where: { organizationId: input.organizationId, leadId: source.id },
      data: { leadId: target.id },
    });
    await tx.lead.update({
      where: { id: source.id },
      data: { isUnsorted: false, stage: "LOST" },
    });
    await tx.activity.create({
      data: {
        organizationId: input.organizationId,
        leadId: target.id,
        type: "SYSTEM",
        authorId: input.actorUserId,
        payloadJson: JSON.stringify({
          action: "unsorted.link",
          fromLeadId: source.id,
        }),
      },
    });
  });
  return { linkedTo: target.id, closedLeadId: source.id };
}

/** Reject: mark LOST and leave unsorted queue. */
export async function rejectUnsortedLead(input: {
  organizationId: string;
  leadId: string;
  actorUserId: string;
}) {
  const lead = await prisma.lead.findFirst({
    where: {
      id: input.leadId,
      organizationId: input.organizationId,
      isUnsorted: true,
    },
  });
  if (!lead) return null;
  const updated = await prisma.lead.update({
    where: { id: lead.id },
    data: { isUnsorted: false, stage: "LOST" },
  });
  await prisma.activity.create({
    data: {
      organizationId: input.organizationId,
      leadId: lead.id,
      type: "SYSTEM",
      authorId: input.actorUserId,
      payloadJson: JSON.stringify({ action: "unsorted.reject" }),
    },
  });
  return updated;
}
