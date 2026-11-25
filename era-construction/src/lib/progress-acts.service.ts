import { prisma } from "@/lib/prisma";
import { progressActReopenDenied } from "@/lib/progress-act-status";
import { findProjectById } from "@/lib/projects.service";

export type ProgressActLineInput = {
  itemCode: string;
  description: string;
  qty: number;
  amountNet: number;
  boqLineId?: string | null;
  sortOrder?: number;
};

export async function findProgressActWithProject(id: string) {
  return prisma.progressAct.findFirst({
    where: { id, deletedAt: null },
    include: {
      project: true,
      lines: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
    },
  });
}

export async function listProgressActsForProject(projectId: string) {
  return prisma.progressAct.findMany({
    where: { projectId, deletedAt: null },
    include: {
      lines: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createDraftProgressAct(
  projectId: string,
  body: { periodKey?: string; amountNet?: number } = {},
) {
  const project = await findProjectById(projectId);
  if (!project) return { error: "Project not found" as const, status: 404 as const };

  const act = await prisma.progressAct.create({
    data: {
      projectId,
      periodKey: body.periodKey,
      amountNet: body.amountNet ?? 0,
      status: "DRAFT",
      financeContractId: project.financeContractId ?? null,
    },
    include: {
      project: true,
      lines: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
    },
  });
  return { act };
}

export async function listProgressActLines(progressActId: string) {
  return prisma.progressActLine.findMany({
    where: { progressActId, deletedAt: null },
    orderBy: { sortOrder: "asc" },
  });
}

/**
 * Replace ops SOV lines on a DRAFT act and keep header amountNet = sum(lines).
 * Accounting truth stays in Finance via the approve event.
 */
export async function replaceProgressActLines(
  progressActId: string,
  lines: ProgressActLineInput[],
) {
  const act = await prisma.progressAct.findFirst({
    where: { id: progressActId, deletedAt: null },
  });
  if (!act) return { error: "Progress act not found" as const, status: 404 as const };
  const denied = progressActReopenDenied(act.status);
  if (act.status === "APPROVED" || denied) {
    return {
      error: denied ?? "Progress act is already approved",
      status: 409 as const,
    };
  }
  if (lines.length === 0) {
    return { error: "At least one line is required", status: 400 as const };
  }

  for (const line of lines) {
    if (line.boqLineId) {
      const boq = await prisma.boqLine.findFirst({
        where: { id: line.boqLineId, projectId: act.projectId, deletedAt: null },
      });
      if (!boq) {
        return {
          error: `BOQ line not found on project: ${line.boqLineId}`,
          status: 400 as const,
        };
      }
    }
  }

  const amountNet = lines.reduce((sum, line) => sum + Number(line.amountNet), 0);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.progressActLine.deleteMany({ where: { progressActId } });
    await tx.progressActLine.createMany({
      data: lines.map((line, index) => ({
        organizationId: act.organizationId,
        progressActId,
        boqLineId: line.boqLineId ?? null,
        itemCode: line.itemCode,
        description: line.description,
        qty: line.qty,
        amountNet: line.amountNet,
        sortOrder: line.sortOrder ?? index,
      })),
    });
    return tx.progressAct.update({
      where: { id: progressActId },
      data: { amountNet },
      include: {
        project: true,
        lines: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
      },
    });
  });

  return { act: updated };
}

export async function patchProgressActFinancePayApp(
  id: string,
  financePayAppId: string | null,
) {
  const existing = await findProgressActWithProject(id);
  if (!existing) return { error: "Progress act not found" as const, status: 404 as const };
  if (existing.status !== "APPROVED") {
    return {
      error: "PayApp ref can only be set on an APPROVED act" as const,
      status: 400 as const,
    };
  }
  const trimmed = financePayAppId?.trim() || null;
  const act = await prisma.progressAct.update({
    where: { id },
    data: { financePayAppId: trimmed },
    include: {
      project: true,
      lines: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
    },
  });
  return { act };
}

export async function approveProgressAct(id: string) {
  const existing = await findProgressActWithProject(id);
  if (!existing) return { error: "Progress act not found" as const, status: 404 as const };
  if (existing.status === "APPROVED" || progressActReopenDenied(existing.status)) {
    return { act: existing, idempotent: true as const };
  }
  // Finance WIP/AR journal requires a positive amount — refuse before dispatch.
  if (Number(existing.amountNet) <= 0) {
    return {
      error: "Progress act amount must be positive before approve",
      status: 400 as const,
    };
  }

  const financeContractId =
    existing.financeContractId || existing.project?.financeContractId || null;

  const act = await prisma.progressAct.update({
    where: { id },
    data: {
      status: "APPROVED",
      approvedAt: new Date(),
      ...(financeContractId && !existing.financeContractId
        ? { financeContractId }
        : {}),
    },
    include: {
      project: true,
      lines: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
    },
  });
  return { act, idempotent: false as const };
}
