import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import {
  SATELLITE_CLINIC_VISIT_COMPLETED,
} from "@era/contracts";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { enterRequestTenant } from "@/lib/request-organization";

const bodySchema = z.object({
  pendingId: z.string().min(1),
  sourceRef: z.string().min(1),
  paymentMethod: z.string().optional(),
  fiscalReceiptId: z.string().nullable().optional(),
  organizationId: z.string().uuid().optional(),
});

function verifyBridge(request: Request): boolean {
  const secret =
    process.env.POS_BRIDGE_SECRET?.trim() ||
    process.env.CLINIC_BRIDGE_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("x-pos-bridge-secret");
  const auth = request.headers.get("authorization");
  if (header === secret) return true;
  if (auth?.startsWith("Bearer ") && auth.slice(7) === secret) return true;
  return false;
}

export async function POST(request: Request) {
  try {
    if (!verifyBridge(request)) {
      return jsonError("Unauthorized", 401);
    }
    const body = bodySchema.parse(await request.json());
    const visit = await prisma.visit.findUnique({
      where: { id: body.sourceRef },
      include: { patientRef: true, serviceLines: true, receipts: true },
    });
    if (!visit) return jsonError("Visit not found", 404);

    if (body.organizationId && body.organizationId !== visit.organizationId) {
      return jsonError("organizationId mismatch", 409);
    }
    enterRequestTenant(body.organizationId ?? visit.organizationId);

    if (visit.settledAt) {
      return jsonOk({ ok: true, alreadySettled: true });
    }

    await prisma.visit.update({
      where: { id: visit.id },
      data: {
        billingTarget: "SETTLEMENT_HUB",
        settlementPendingId: body.pendingId,
        hubFiscalReceiptId: body.fiscalReceiptId ?? null,
        settledAt: new Date(),
      },
    });

    const amountNet = Number(visit.amountNet);
    if (amountNet > 0) {
      await dispatchSatelliteEvent({
        type: SATELLITE_CLINIC_VISIT_COMPLETED,
        globalPersonId: visit.patientRef.globalPersonId ?? undefined,
        payload: {
          visitId: visit.id,
          patientRef: visit.patientRef.refCode,
          serviceCodes: visit.serviceLines.map((l: { serviceCode: string }) => l.serviceCode),
          amountNet,
          currency: "AZN",
          settlementPendingId: body.pendingId,
          hubFiscalReceiptId: body.fiscalReceiptId ?? undefined,
        },
      });
    }

    return jsonOk({ ok: true, visitId: visit.id, settled: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
