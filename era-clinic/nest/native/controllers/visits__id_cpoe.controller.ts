import { Controller, Get, HttpCode, Post, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { createVisitCpoeEntry, getVisitForWrite, listVisitCpoeEntries, visitExists } from "@/domain/visit/visit.service";


const bodySchema = z.object({
  templateId: z.string().optional(),
  payloadJson: z.string().default("{}"),
});

@Controller()
export class VisitsIdCpoeController {

  @UseGuards(ClinicApiGuard)
  @Get("api/visits/:id/cpoe")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {


  
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_VISITS_READ);
    if (denied) return clinicBody(denied);

    const { id } = httpReq.params;
    if (!(await visitExists(id))) throw new HttpException({ error: "Visit not found" }, 404);

    const entries = await listVisitCpoeEntries(id);
    return { items: entries };
  
        });
  }

  @UseGuards(ClinicApiGuard)
  @Post("api/visits/:id/cpoe")
  @HttpCode(200)
  async post_1(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_VISITS);
    if (denied) return clinicBody(denied);

    const { id } = httpReq.params;
    const visit = await getVisitForWrite(id);
    if (!visit) throw new HttpException({ error: "Visit not found" }, 404);
    const { visitAwaitingPaymentDenied } = await import("@/domain/visit/visit-pay-gate");
    const unpaid = visitAwaitingPaymentDenied(visit);
    if (unpaid) throw new HttpException({ error: unpaid.message, ...{ code: unpaid.code } }, unpaid.status);
    const body = bodySchema.parse(httpReq.body);
    const entry = await createVisitCpoeEntry({
      visitId: id,
      templateId: body.templateId,
      payloadJson: body.payloadJson,
    });
    throw new HttpException(entry, 201);
  
        });
  }
}
