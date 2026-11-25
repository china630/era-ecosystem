import { Controller, HttpCode, Post, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import { withClinicStaff, clinicBody } from "../../bridge";
import { SATELLITE_CLINIC_PRESCRIPTION_ISSUED } from "@era/contracts";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { getVisitWithPatientRef } from "@/domain/visit/visit.service";
import {
  createPrescriptionForVisit,
  resolveLineSku,
  type PrescriptionLineInput,
} from "@/domain/prescription/prescription.service";
import { z } from "zod";

const lineSchema = z
  .object({
    sku: z.string().optional(),
    medicationId: z.string().optional(),
    qty: z.number().positive(),
    rxRequired: z.boolean().optional(),
    description: z.string().optional(),
    dose: z.string().optional(),
    route: z.string().optional(),
    frequency: z.string().optional(),
    durationDays: z.number().int().positive().optional(),
    instructions: z.string().optional(),
  })
  .refine((line) => Boolean(line.sku?.trim() || line.medicationId), {
    message: "sku or medicationId required",
  });

const schema = z.object({
  lines: z.array(lineSchema).min(1),
});

@Controller()
export class VisitsIdPrescriptionController {
  @UseGuards(ClinicApiGuard)
  @Post("api/visits/:id/prescription")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_VISITS);
      if (denied) return clinicBody(denied);

      const { id } = httpReq.params;
      const body = schema.parse(httpReq.body);
      const visit = await getVisitWithPatientRef(id);
      if (!visit) throw new HttpException({ error: "Visit not found" }, 404);
      const { visitAwaitingPaymentDenied } = await import("@/domain/visit/visit-pay-gate");
      const unpaid = visitAwaitingPaymentDenied(visit);
      if (unpaid) throw new HttpException({ error: unpaid.message, code: unpaid.code }, unpaid.status);

      const retailLines: Array<{ sku: string; qty: number; rxRequired?: boolean; description?: string }> = [];
      for (const line of body.lines as PrescriptionLineInput[]) {
        retailLines.push({
          sku: await resolveLineSku(line, visit.organizationId),
          qty: line.qty,
          rxRequired: line.rxRequired,
          description: line.description ?? line.instructions,
        });
      }

      await dispatchSatelliteEvent({
        type: SATELLITE_CLINIC_PRESCRIPTION_ISSUED,
        globalPersonId: visit.patientRef.globalPersonId ?? undefined,
        payload: {
          visitId: visit.id,
          patientRef: visit.patientRef.refCode,
          patientOrigin: visit.patientOrigin,
          lines: retailLines,
          currency: "AZN",
        },
      });

      const retailBase = (process.env.RETAIL_POS_URL ?? "http://127.0.0.1:3204").replace(/\/$/, "");
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
          lines: retailLines,
        }),
      });
      if (!queued.ok) {
        throw new HttpException({ error: "Pharmacy queue rejected the prescription" }, 502);
      }
      const queueBody = (await queued.json()) as { id?: string; data?: { id?: string } };
      const prescriptionQueueId = queueBody.data?.id ?? queueBody.id ?? null;

      const prescription = await createPrescriptionForVisit({
        visitId: visit.id,
        patientRefId: visit.patientRefId,
        organizationId: visit.organizationId,
        issuedByUserId: session?.sub,
        prescriptionQueueId,
        lines: body.lines,
      });

      return {
        visitId: visit.id,
        prescriptionId: prescription.id,
        prescriptionQueueId,
      };
    });
  }
}