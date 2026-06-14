import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const assignment = await prisma.bedAssignment.findUnique({
      where: { id },
      include: { bed: true },
    });
    if (!assignment) return jsonError("Assignment not found", 404);
    if (assignment.dischargedAt) return jsonError("Already discharged", 400);

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.bedAssignment.update({
        where: { id },
        data: { dischargedAt: new Date() },
      });
      await tx.bed.update({
        where: { id: assignment.bedId },
        data: { status: "AVAILABLE" },
      });
      return row;
    });

    return jsonOk(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
