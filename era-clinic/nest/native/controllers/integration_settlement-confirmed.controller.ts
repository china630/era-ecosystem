import { Controller, HttpCode, Post, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  nestHeader,
  withClinicHttp,
} from "../../bridge";
import { z } from "zod";
import { SATELLITE_CLINIC_VISIT_COMPLETED } from "@era/contracts";
import { assertRevenueEventForPublish } from "@era/satellite-kit";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { enterRequestTenant } from "@/lib/request-organization";
import { finalizeVisitBridgeSettlement, findBridgeProcedureOrder, loadVisitForBridgeSettlement, peelVisitSettlementPendingId, settleBridgeLabOrder } from "@/domain/cashier/cashier-settle.service";


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
  const header = nestHeader(request, "x-pos-bridge-secret");
  const auth = nestHeader(request, "authorization");
  if (header === secret) return true;
  if (auth?.startsWith("Bearer ") && auth.slice(7) === secret) return true;
  return false;
}

@Controller()
export class IntegrationSettlementConfirmedController {

  @Post("api/integration/settlement-confirmed")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      if (!verifyBridge(httpReq)) {
      throw new HttpException({ error: "Unauthorized" }, 401);
    }
    const body = bodySchema.parse(httpReq.body);
    const organizationId = body.organizationId?.trim() ?? "";
    if (!organizationId) throw new HttpException({ error: "organizationId required" }, 400);
    enterRequestTenant(organizationId);

    if (body.sourceRef.startsWith("clinic-rx-")) {
      return { ok: true, prescription: true };
    }

    const { recordWalkInPartySettlement } = await import(
      "@/domain/sanatorium/walk-in-party.service"
    );

    if (body.sourceRef.startsWith("lab:")) {
      const labId = body.sourceRef.slice(4);
      const lab = await settleBridgeLabOrder(labId, body.pendingId);
      if (!lab.ok) throw new HttpException({ error: "Lab order not found" }, 404);
      await recordWalkInPartySettlement(body.sourceRef, "Hotel cashier");
      return { ok: true, labOrderId: lab.labOrderId, settled: true };
    }

    const walkIn = await import("@/domain/sanatorium/extras-assign.service").then((mod) =>
      mod.scheduleWalkInExtraAfterSettlement(body.sourceRef),
    );
    if (walkIn) {
      await recordWalkInPartySettlement(body.sourceRef, "Hotel cashier");
      return { ok: true, procedureOrderId: body.sourceRef, scheduled: true };
    }

    const procedure = await findBridgeProcedureOrder(body.sourceRef);
    if (procedure) {
      if (procedure.status === "PENDING_PAY") {
        throw new HttpException({ error: "Procedure was not seated" }, 409);
      }
      await recordWalkInPartySettlement(body.sourceRef, "Hotel cashier");
      return { ok: true, procedureOrderId: procedure.id, already: true };
    }

    const visit = await loadVisitForBridgeSettlement(body.sourceRef);
    if (!visit) throw new HttpException({ error: "Visit not found" }, 404);

    if (visit.settledAt) {
      return { ok: true, alreadySettled: true };
    }

    const peeled = await peelVisitSettlementPendingId(visit, body.pendingId);
    if (peeled.kind === "waiting") {
      return { ok: true, waiting: peeled.left };
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
    return { ok: true, visitId: visit.id, settled: true };
  
        });
  }
}
