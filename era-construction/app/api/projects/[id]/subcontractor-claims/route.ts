import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  subcontractorName: z.string().min(1),
  amountNet: z.number().nonnegative(),
  notes: z.string().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const claims = await prisma.subcontractorClaim.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
    });
    return jsonOk(claims);
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
    const claim = await prisma.subcontractorClaim.create({
      data: {
        projectId: id,
        subcontractorName: body.subcontractorName,
        amountNet: body.amountNet,
        notes: body.notes,
        status: "SUBMITTED",
      },
    });
    return jsonOk(claim, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
