import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return jsonError("Project not found", 404);
    const tasks = await prisma.projectTask.findMany({
      where: { projectId: id },
      orderBy: { startDate: "asc" },
    });
    return jsonOk({ projectId: id, tasks });
  } catch (err) {
    return handleRouteError(err);
  }
}
