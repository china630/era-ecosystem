/** Lifted from nest/generated/integration_prescription-queue.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { enterRequestTenant, requestOrganizationId } from "@/lib/request-organization";
import { createPrescriptionQueueRow } from "@/lib/prescription-queue.service";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const lineSchema = z.object({
  sku: z.string().min(1),
  qty: z.number().positive(),
  description: z.string().optional(),
});

const createSchema = z.object({
  organizationId: z.string().min(1),
  visitId: z.string().min(1),
  patientRef: z.string().min(1),
  patientOrigin: z.string().min(1),
  reservationId: z.string().nullable().optional(),
  lines: z.array(lineSchema).min(1),
});

function serviceToken(request: Request): boolean {
  const expected =
    process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim() ||
    process.env.POS_BRIDGE_SECRET?.trim() ||
    "";
  if (!expected) return false;
  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${expected}`;
}


@Controller()
export class IntegrationPrescriptionQueueController {
  @Post("api/integration/prescription-queue")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  
    if (!serviceToken(request)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const body = createSchema.parse(httpReq.body);
    enterRequestTenant(body.organizationId);
    const row = await createPrescriptionQueueRow({
      organizationId: requestOrganizationId() || body.organizationId,
      visitId: body.visitId,
      patientRef: body.patientRef,
      patientOrigin: body.patientOrigin,
      reservationId: body.reservationId ?? null,
      linesJson: JSON.stringify(body.lines),
    });
    return sendJson(httpRes, { id: row.id, status: row.status }, 201);
  
        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
