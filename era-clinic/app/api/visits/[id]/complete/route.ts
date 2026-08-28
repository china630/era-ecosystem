import { requestOrganizationId } from "@/lib/request-organization";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { completeVisitBilling } from "@/lib/billing-router";
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
      include: { patientRef: true, serviceLines: true, appointment: true },
    });

    if (completed.appointment) {
      await prisma.appointment.update({
        where: { id: completed.appointment.id },
        data: { status: "COMPLETED" },
      });
    }

    const billing = await completeVisitBilling(completed.id);

    const organizationId = requestOrganizationId();
    const amountNet = Number(completed.amountNet);
    if (organizationId && amountNet > 0 && billing.channel === "finance") {
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
        // optional
      }
      try {
        await createPortalLink(
          { entityType: "clinic_visit", entityId: completed.id },
          { organizationId },
        );
      } catch {
        // optional
      }
    }

    return jsonOk({ ...completed, billing });
  } catch (err) {
    return handleRouteError(err);
  }
}
