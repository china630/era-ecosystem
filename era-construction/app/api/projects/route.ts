import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  projectCode: z.string(),
  projectName: z.string(),
  periodKey: z.string().optional(),
  amountNet: z.number().nonnegative(),
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
        data: { code: body.projectCode, name: body.projectName },
      });
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
