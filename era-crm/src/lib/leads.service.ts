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
      selectionPackages: { include: { items: true }, orderBy: { createdAt: "desc" } },
      warrantyCases: { orderBy: { createdAt: "desc" } },
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
  opts?: {
    authorId?: string;
    pipelineId?: string | null;
    stageId?: string | null;
    skipPipelineRules?: boolean;
  },
) {
  const updated = await prisma.lead.update({
    where: { id },
    data: {
      stage,
      ...(opts?.pipelineId !== undefined
        ? { pipelineId: opts.pipelineId }
        : {}),
      ...(opts?.stageId !== undefined ? { stageId: opts.stageId } : {}),
    },
    include: {
      pipelineStage: true,
    },
  });
  await prisma.leadStageHistory.create({
    data: {
      organizationId: updated.organizationId,
      leadId: id,
      fromStage,
      toStage: stage,
    },
  });
  await prisma.activity.create({
    data: {
      organizationId: updated.organizationId,
      leadId: id,
      type: "STAGE",
      authorId: opts?.authorId,
      payloadJson: JSON.stringify({
        fromStage,
        toStage: stage,
        pipelineId: updated.pipelineId,
        stageId: updated.stageId,
      }),
    },
  });
  if (!opts?.skipPipelineRules) {
    const { applyAllPipelineRules } = await import(
      "@/lib/integrations/pipeline-lite.service"
    );
    await applyAllPipelineRules({
      organizationId: updated.organizationId,
      leadId: id,
      trigger: "STAGE_ENTER",
      fromStage,
      toStage: stage,
    });
  }
  return updated;
}

/** Move lead onto a PipelineStage (P0-5); syncs legacy LeadStage when mapped. */
export async function moveLeadToPipelineStage(
  leadId: string,
  pipelineStageId: string,
  opts?: { authorId?: string },
) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return null;
  const stageRow = await prisma.pipelineStage.findFirst({
    where: {
      id: pipelineStageId,
      organizationId: lead.organizationId,
    },
  });
  if (!stageRow) return null;
  const legacy: LeadStage =
    stageRow.legacyStage ??
    (stageRow.kind === "WON"
      ? "WON"
      : stageRow.kind === "LOST"
        ? "LOST"
        : lead.stage === "WON" || lead.stage === "LOST"
          ? "CONTACTED"
          : lead.stage);
  return updateLeadStage(leadId, legacy, lead.stage, {
    authorId: opts?.authorId,
    pipelineId: stageRow.pipelineId,
    stageId: stageRow.id,
  });
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

export async function findUserById(id: string, organizationId?: string) {
  return prisma.user.findFirst({
    where: organizationId ? { id, organizationId } : { id },
  });
}

export async function convertLeadWon(
  id: string,
  fromStage: LeadStage,
  data: { counterpartyId?: string | null; authorId?: string },
) {
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.lead.update({
      where: { id },
      data: {
        stage: "WON",
        convertedAt: new Date(),
        counterpartyId: data.counterpartyId,
        isUnsorted: false,
      },
    });
    await tx.leadStageHistory.create({
      data: {
        organizationId: row.organizationId,
        leadId: id,
        fromStage,
        toStage: "WON",
      },
    });
    await tx.activity.create({
      data: {
        organizationId: row.organizationId,
        leadId: id,
        type: "SYSTEM",
        authorId: data.authorId,
        payloadJson: JSON.stringify({ action: "convert", fromStage }),
      },
    });
    const existingPkg = await tx.selectionPackage.findFirst({
      where: { leadId: id, status: "OPEN" },
    });
    if (!existingPkg) {
      await tx.selectionPackage.create({
        data: {
          organizationId: row.organizationId,
          leadId: id,
          status: "OPEN",
          notes: "Seeded on convert",
        },
      });
    }
    return row;
  });
  // Best-effort Meta CAPI when org has enabled meta_capi connection (I-4).
  void import("@/lib/integrations/meta-capi-convert").then(({ fireMetaCapiOnWon }) =>
    fireMetaCapiOnWon(id),
  );
  return updated;
}
