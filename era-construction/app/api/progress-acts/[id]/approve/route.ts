import { SATELLITE_CONSTRUCTION_PROGRESS_ACT_APPROVED } from "@era/contracts";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const act = await prisma.progressAct.findUnique({
      where: { id },
      include: { project: true },
    });
    if (!act) return jsonError("Progress act not found", 404);
    if (act.status === "APPROVED") return jsonOk(act);

    const approved = await prisma.progressAct.update({
      where: { id },
      data: { status: "APPROVED", approvedAt: new Date() },
      include: { project: true },
    });

    await dispatchSatelliteEvent({
      type: SATELLITE_CONSTRUCTION_PROGRESS_ACT_APPROVED,
      payload: {
        projectId: approved.projectId,
        actId: approved.id,
        amountNet: Number(approved.amountNet),
        currency: "AZN",
        periodKey: approved.periodKey ?? undefined,
      },
    });

    return jsonOk(approved);
  } catch (err) {
    return handleRouteError(err);
  }
}
