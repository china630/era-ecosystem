import { Controller, Delete, Get, HttpCode, Post, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { addVisitDiagnosis, deleteVisitDiagnosis, listVisitDiagnoses } from "@/domain/icd/diagnosis-write.service";
import { getVisitPayGateSnapshot } from "@/domain/visit/visit.service";


const createSchema = z.object({
  icdCodeId: z.string().min(1),
  role: z.enum(["PRIMARY", "SECONDARY"]).optional(),
  note: z.string().max(500).optional().nullable(),
});

@Controller()
export class VisitsIdDiagnosesController {

  @UseGuards(ClinicApiGuard)
  @Get("api/visits/:id/diagnoses")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {


  
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_VISITS_READ);
    if (denied) return clinicBody(denied);

        const { id } = httpReq.params;
    return { items: await listVisitDiagnoses(id) };
  
        });
  }

  @UseGuards(ClinicApiGuard)
  @Post("api/visits/:id/diagnoses")
  @HttpCode(200)
  async post_1(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      if (!session) throw new HttpException({ error: "Unauthorized" }, 401);
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_VISITS);
    if (denied) return clinicBody(denied);

    const { id } = httpReq.params;
    const visit = await getVisitPayGateSnapshot(id);
    if (!visit) throw new HttpException({ error: "Visit not found" }, 404);
    const { visitAwaitingPaymentDenied } = await import("@/domain/visit/visit-pay-gate");
    const unpaid = visitAwaitingPaymentDenied(visit);
    if (unpaid) throw new HttpException({ error: unpaid.message, ...{ code: unpaid.code } }, unpaid.status);
    const body = createSchema.parse(httpReq.body);
    const row = await addVisitDiagnosis(id, {
      ...body,
      recordedByUserId: session.sub,
    });
    throw new HttpException(row, 201);
  
        });
  }

  @UseGuards(ClinicApiGuard)
  @Delete("api/visits/:id/diagnoses")
  @HttpCode(200)
  async delete_2(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_VISITS);
    if (denied) return clinicBody(denied);

        const id = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").searchParams.get("id");
    if (!id) throw new HttpException({ error: "id required" }, 400);
    await deleteVisitDiagnosis(id);
    return { deleted: true };
  
        });
  }
}
