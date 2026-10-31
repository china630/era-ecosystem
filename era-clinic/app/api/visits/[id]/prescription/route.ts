import { SATELLITE_CLINIC_PRESCRIPTION_ISSUED } from "@era/contracts";
import {
  jsonOk,
  jsonError,
  handleRouteError,
  getSatelliteSession,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  lines: z.array(
    z.object({
      sku: z.string(),
      qty: z.number().positive(),
      rxRequired: z.boolean().optional(),
      description: z.string().optional(),
    }),
  ).min(1),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSatelliteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_VISITS);
    if (denied) return denied;

    const { id } = await params;
    const body = schema.parse(await req.json());
    const visit = await prisma.visit.findUnique({
      where: { id },
      include: { patientRef: true },
    });
    if (!visit) return jsonError("Visit not found", 404);
    const { visitAwaitingPaymentDenied } = await import("@/domain/visit/visit-pay-gate");
    const unpaid = visitAwaitingPaymentDenied(visit);
    if (unpaid) return jsonError(unpaid.message, unpaid.status, { code: unpaid.code });

    await dispatchSatelliteEvent({
      type: SATELLITE_CLINIC_PRESCRIPTION_ISSUED,
      globalPersonId: visit.patientRef.globalPersonId ?? undefined,
      payload: {
        visitId: visit.id,
        patientRef: visit.patientRef.refCode,
        patientOrigin: visit.patientOrigin,
        lines: body.lines,
        currency: "AZN",
      },
    });

    for (const line of body.lines) {
      if (!line.sku.trim()) throw new Error("Finance SKU is required");
    }

    const retailBase = (process.env.RETAIL_POS_URL ?? "http://127.0.0.1:3204").replace(
      /\/$/,
      "",
    );
    const token = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim() ?? "";
    const queued = await fetch(`${retailBase}/api/integration/prescription-queue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        organizationId: visit.organizationId,
        patientRef: visit.patientRef.refCode,
        visitId: visit.id,
        patientOrigin: visit.patientOrigin,
        reservationId: visit.reservationId,
        lines: body.lines,
      }),
    });
    if (!queued.ok) {
      return jsonError("Pharmacy queue rejected the prescription", 502);
    }
    const queueBody = (await queued.json()) as { id?: string; data?: { id?: string } };

    return jsonOk({
      visitId: visit.id,
      prescriptionQueueId: queueBody.data?.id ?? queueBody.id ?? null,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
