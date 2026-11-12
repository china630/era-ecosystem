import { z } from "zod";
import { SATELLITE_CLINIC_VISIT_COMPLETED } from "@era/contracts";
import { assertRevenueEventForPublish } from "@era/satellite-kit";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { enterRequestTenant } from "@/lib/request-organization";
import { finalizeVisitBridgeSettlement, findBridgeProcedureOrder, loadVisitForBridgeSettlement, peelVisitSettlementPendingId, settleBridgeLabOrder } from "@/domain/cashier/cashier-settle.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

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

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/integration/settlement-confirmed", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    if (!verifyBridge(request)) {
      return sendJson(httpRes, { error: "Unauthorized" }, 401);
    }
    const body = bodySchema.parse(httpReq.body);
    const organizationId = body.organizationId?.trim() ?? "";
    if (!organizationId) return sendJson(httpRes, { error: "organizationId required" }, 400);
    enterRequestTenant(organizationId);

    if (body.sourceRef.startsWith("clinic-rx-")) {
      return sendJson(httpRes, { ok: true, prescription: true });
    }

    const { recordWalkInPartySettlement } = await import(
      "@/domain/sanatorium/walk-in-party.service"
    );

    if (body.sourceRef.startsWith("lab:")) {
      const labId = body.sourceRef.slice(4);
      const lab = await settleBridgeLabOrder(labId, body.pendingId);
      if (!lab.ok) return sendJson(httpRes, { error: "Lab order not found" }, 404);
      await recordWalkInPartySettlement(body.sourceRef, "Hotel cashier");
      return sendJson(httpRes, { ok: true, labOrderId: lab.labOrderId, settled: true });
    }

    const walkIn = await import("@/domain/sanatorium/extras-assign.service").then((mod) =>
      mod.scheduleWalkInExtraAfterSettlement(body.sourceRef),
    );
    if (walkIn) {
      await recordWalkInPartySettlement(body.sourceRef, "Hotel cashier");
      return sendJson(httpRes, { ok: true, procedureOrderId: body.sourceRef, scheduled: true });
    }

    const procedure = await findBridgeProcedureOrder(body.sourceRef);
    if (procedure) {
      if (procedure.status === "PENDING_PAY") {
        return sendJson(httpRes, { error: "Procedure was not seated" }, 409);
      }
      await recordWalkInPartySettlement(body.sourceRef, "Hotel cashier");
      return sendJson(httpRes, { ok: true, procedureOrderId: procedure.id, already: true });
    }

    const visit = await loadVisitForBridgeSettlement(body.sourceRef);
    if (!visit) return sendJson(httpRes, { error: "Visit not found" }, 404);

    if (visit.settledAt) {
      return sendJson(httpRes, { ok: true, alreadySettled: true });
    }

    const peeled = await peelVisitSettlementPendingId(visit, body.pendingId);
    if (peeled.kind === "waiting") {
      return sendJson(httpRes, { ok: true, waiting: peeled.left });
    }

    const amountNet = Number(visit.amountNet);
    if (amountNet > 0) {
      await assertRevenueEventForPublish({
        organizationId,
        fromSatelliteKey: "industry_clinic",
        eventType: SATELLITE_CLINIC_VISIT_COMPLETED,
      });
    }

    await finalizeVisitBridgeSettlement(visit.id, {
      pendingId: body.pendingId,
      fiscalReceiptId: body.fiscalReceiptId,
      paidAt: visit.paidAt,
    });

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

    await recordWalkInPartySettlement(body.sourceRef, "Hotel cashier");
    return sendJson(httpRes, { ok: true, visitId: visit.id, settled: true });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
