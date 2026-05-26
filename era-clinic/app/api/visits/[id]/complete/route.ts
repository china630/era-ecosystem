import { SATELLITE_CLINIC_VISIT_COMPLETED } from "@era/contracts";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import {
  createPortalLink,
  createPaymentLink,
} from "@/integration/control-plane-platform.client";
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

    const organizationId = process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim() ?? "";
    const amountNet = Number(completed.amountNet);
    if (organizationId && amountNet > 0) {
      try {
        await createPaymentLink(
          {
            amountAzn: amountNet,
            sourceEntityType: "clinic_visit",
            sourceEntityId: completed.id,
            description: `Visit ${completed.patientRef.refCode}`,
          },
          { organizationId },
        );
      } catch {
        // optional payment link
      }
      try {
        await createPortalLink(
          { entityType: "clinic_visit", entityId: completed.id },
          { organizationId },
        );
      } catch {
        // optional portal
      }
    }

    return jsonOk(completed);
  } catch (err) {
    return handleRouteError(err);
  }
}
