import { SATELLITE_CLINIC_VISIT_COMPLETED } from "@era/contracts";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const visit = await prisma.visit.findUnique({
      where: { id },
      include: { patientRef: true, serviceLines: true },
    });
    if (!visit) return jsonError("Visit not found", 404);
    if (visit.status === "COMPLETED") return jsonOk(visit);

    const completed = await prisma.visit.update({
      where: { id },
      data: { status: "COMPLETED", completedAt: new Date() },
      include: { patientRef: true, serviceLines: true },
    });

    await dispatchSatelliteEvent({
      type: SATELLITE_CLINIC_VISIT_COMPLETED,
      payload: {
        visitId: completed.id,
        patientRef: completed.patientRef.refCode,
        serviceCodes: completed.serviceLines.map((l) => l.serviceCode),
        amountNet: Number(completed.amountNet),
        currency: "AZN",
      },
    });

    return jsonOk(completed);
  } catch (err) {
    return handleRouteError(err);
  }
}
