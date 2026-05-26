import { SATELLITE_CLINIC_LAB_ORDER_COMPLETED } from "@era/contracts";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { createPaymentLink } from "@/integration/control-plane-platform.client";
import { prisma } from "@/lib/prisma";

function testCodesFromOrder(testCode: string): string[] {
  return testCode.split(",").map((c) => c.trim()).filter(Boolean);
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const order = await prisma.labOrder.findUnique({
      where: { id },
      include: { patientRef: true, visit: true },
    });
    if (!order) return jsonError("Lab order not found", 404);
    if (order.status === "COMPLETED") return jsonOk(order);
    if (order.status !== "PUBLISHED") {
      return jsonError(
        `Complete requires PUBLISHED status (current: ${order.status})`,
        400,
      );
    }

    const completed = await prisma.labOrder.update({
      where: { id },
      data: { status: "COMPLETED", completedAt: new Date() },
      include: { patientRef: true, visit: true },
    });

    const testCodes = testCodesFromOrder(completed.testCode);

    await dispatchSatelliteEvent({
      type: SATELLITE_CLINIC_LAB_ORDER_COMPLETED,
      payload: {
        labOrderId: completed.id,
        orderId: completed.id,
        visitId: completed.visitId ?? undefined,
        patientRef: completed.patientRef.refCode,
        testCode: testCodes[0] ?? completed.testCode,
        testCodes,
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
            sourceEntityType: "clinic_lab_order",
            sourceEntityId: completed.id,
            description: `Lab ${completed.testCode}`,
          },
          { organizationId },
        );
      } catch {
        // optional payment link
      }
    }

    return jsonOk(completed);
  } catch (err) {
    return handleRouteError(err);
  }
}
