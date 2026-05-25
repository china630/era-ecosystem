import { jsonError, jsonOk, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        boqLines: true,
        materialRequisitions: true,
        progressActs: true,
      },
    });
    if (!project) return jsonError("Project not found", 404);

    const requisitionByItem = new Map<string, number>();
    for (const req of project.materialRequisitions) {
      const key = req.itemCode;
      requisitionByItem.set(
        key,
        (requisitionByItem.get(key) ?? 0) + Number(req.qty),
      );
    }

    const approvedProgress = project.progressActs
      .filter((a) => a.status === "APPROVED")
      .reduce((sum, a) => sum + Number(a.amountNet), 0);

    const lines = project.boqLines.map((boq) => {
      const requisitionQty = requisitionByItem.get(boq.itemCode) ?? 0;
      const plannedQty = Number(boq.plannedQty);
      return {
        itemCode: boq.itemCode,
        description: boq.description,
        plannedQty,
        plannedAmountNet: Number(boq.plannedAmountNet),
        requisitionQty,
        varianceQty: requisitionQty - plannedQty,
      };
    });

    const plannedAmountTotal = lines.reduce(
      (s, l) => s + l.plannedAmountNet,
      0,
    );

    return jsonOk({
      projectId: project.id,
      projectCode: project.code,
      projectName: project.name,
      lines,
      totals: {
        plannedAmountNet: plannedAmountTotal,
        progressApprovedNet: approvedProgress,
        varianceAmountNet: approvedProgress - plannedAmountTotal,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
