import { Controller, Get, HttpCode, Post, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import { withClinicStaff, clinicBody } from "../../bridge";
import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { getVisitPayGateSnapshot, getVisitWithPatientRef } from "@/domain/visit/visit.service";
import {
  createVisitClinicalNote,
  findPractitionerIdForUser,
  listVisitClinicalNotes,
} from "@/domain/notes/clinical-note.service";

const createSchema = z.object({
  templateId: z.string().min(1),
  kind: z
    .enum([
      "VISIT_EXAM",
      "ADMISSION_EXAM",
      "DAILY_DIARY",
      "STAGE_EPICRISIS",
      "DISCHARGE_SUMMARY",
      "CONSULTATION",
    ])
    .optional(),
  fieldValues: z.record(z.string()).optional(),
  copyFromNoteId: z.string().optional(),
});

@Controller()
export class VisitsIdNotesController {
  @UseGuards(ClinicApiGuard)
  @Get("api/visits/:id/notes")
  @HttpCode(200)
  async getNotes(@Req() httpReq: Request) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_VISITS_READ);
      if (denied) return clinicBody(denied);
      const { id } = httpReq.params;
      return { items: await listVisitClinicalNotes(id) };
    });
  }

  @UseGuards(ClinicApiGuard)
  @Post("api/visits/:id/notes")
  @HttpCode(200)
  async postNote(@Req() httpReq: Request) {
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
      if (unpaid) {
        throw new HttpException({ error: unpaid.message, code: unpaid.code }, unpaid.status);
      }

      const body = createSchema.parse(httpReq.body);
      let authorPractitionerId = await findPractitionerIdForUser(session.sub);
      if (!authorPractitionerId) {
        const v = await getVisitWithPatientRef(id);
        authorPractitionerId = v?.practitionerId ?? null;
      }
      if (!authorPractitionerId) {
        throw new HttpException({ error: "No practitioner linked to session" }, 403);
      }

      const row = await createVisitClinicalNote({
        visitId: id,
        templateId: body.templateId,
        kind: body.kind,
        fieldValues: body.fieldValues,
        copyFromNoteId: body.copyFromNoteId,
        authorPractitionerId,
        userId: session.sub,
        request: httpReq,
      });
      throw new HttpException(row, 201);
    });
  }
}