import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  projectCode: z.string(),
  projectName: z.string(),
  periodKey: z.string().optional(),
  amountNet: z.number().nonnegative(),
  boqLines: z
    .array(
      z.object({
        itemCode: z.string(),
        description: z.string(),
        plannedQty: z.number().positive(),
        plannedAmountNet: z.number().nonnegative().optional(),
      }),
    )
    .optional(),
});

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      include: { progressActs: true },
      orderBy: { createdAt: "desc" },
    });
    return jsonOk(projects);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = createSchema.parse(await req.json());
    let project = await prisma.project.findUnique({
      where: { code: body.projectCode },
    });
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

    const act = await prisma.progressAct.create({
      data: {
        projectId: project.id,
        periodKey: body.periodKey,
        amountNet: body.amountNet,
      },
    });
    return jsonOk({ project, act }, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
