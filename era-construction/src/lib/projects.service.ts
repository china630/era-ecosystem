import { prisma } from "@/lib/prisma";

export async function listProjects() {
  return prisma.project.findMany({
    include: { progressActs: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function findProjectById(id: string) {
  return prisma.project.findUnique({ where: { id } });
}

export async function findProjectByCode(code: string) {
  return prisma.project.findUnique({
    where: { code } as never,
  });
}

export type CreateProjectWithActInput = {
  projectCode: string;
  projectName: string;
  periodKey?: string;
  amountNet: number;
  boqLines?: Array<{
    itemCode: string;
    description: string;
    plannedQty: number;
    plannedAmountNet?: number;
  }>;
};

export async function createOrUpdateProjectWithProgressAct(body: CreateProjectWithActInput) {
  let project = await findProjectByCode(body.projectCode);
  if (!project) {
    project = await prisma.project.create({
      data: {
        code: body.projectCode,
        name: body.projectName,
        boqLines: body.boqLines?.length
          ? {
              create: body.boqLines.map((line) => ({
                itemCode: line.itemCode,
                description: line.description,
                plannedQty: line.plannedQty,
                plannedAmountNet: line.plannedAmountNet ?? 0,
              })),
            }
          : undefined,
      },
    });
  } else if (body.boqLines?.length) {
    for (const line of body.boqLines) {
      await prisma.boqLine.upsert({
        where: {
          projectId_itemCode: {
            projectId: project.id,
            itemCode: line.itemCode,
          },
        },
        update: {
          description: line.description,
          plannedQty: line.plannedQty,
          plannedAmountNet: line.plannedAmountNet ?? 0,
        },
        create: {
          projectId: project.id,
          itemCode: line.itemCode,
          description: line.description,
          plannedQty: line.plannedQty,
          plannedAmountNet: line.plannedAmountNet ?? 0,
        },
      });
    }
  }
  if (!project) throw new Error("Project missing after ensure");

  const act = await prisma.progressAct.create({
    data: {
      projectId: project.id,
      periodKey: body.periodKey,
      amountNet: body.amountNet,
    },
  });
  return { project, act };
}

export async function findProjectPlanVsActual(projectId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
    include: {
      boqLines: true,
      materialRequisitions: true,
      progressActs: true,
    },
  });
}
