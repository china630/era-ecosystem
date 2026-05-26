import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  logDate: z.string(),
  weather: z.string().optional(),
  crewCount: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
  reportedBy: z.string().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const logs = await prisma.dailyLog.findMany({
      where: { projectId: id },
      orderBy: { logDate: "desc" },
    });
    return jsonOk(logs);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return jsonError("Project not found", 404);
    const body = createSchema.parse(await req.json());
    const log = await prisma.dailyLog.create({
      data: {
        projectId: id,
        logDate: new Date(body.logDate),
        weather: body.weather,
        crewCount: body.crewCount,
        notes: body.notes,
        reportedBy: body.reportedBy,
      },
    });
    return jsonOk(log, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
