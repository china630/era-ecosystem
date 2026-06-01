import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const projectId = new URL(req.url).searchParams.get("projectId");
    const rows = await prisma.drawingRevision.findMany({
      where: projectId ? { projectId } : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return jsonOk({ documents: rows });
  } catch (err) {
    return handleRouteError(err);
  }
}

const bodySchema = z.object({
  projectId: z.string(),
  drawingCode: z.string(),
  revision: z.string(),
  fileName: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = bodySchema.parse(await req.json());
    const row = await prisma.drawingRevision.create({ data: body });
    return jsonOk(row, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
