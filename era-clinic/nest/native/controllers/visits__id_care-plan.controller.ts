import { Controller, Get, HttpCode, Patch, Post, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import { withClinicStaff, clinicBody } from "../../bridge";
import { z } from "zod";
import { handleRouteError, requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import {
  getCarePlanForVisit,
  upsertCarePlanForVisit,
} from "@/domain/care-plan/ambulatory-care-plan.service";
import { prisma } from "@/lib/prisma";
import { DEFAULT_CARE_PLAN_STAGES } from "@/domain/care-plan/ambulatory-care-plan.types";

const stageSchema = z.object({
  code: z.string().min(1),
  title: z.string().min(1),
  serviceCodes: z.array(z.string()).optional(),
  estimatedAmountAzn: z.number().optional(),
  status: z.enum(["PENDING", "SCHEDULED", "DONE", "SKIPPED"]),
});

const writeSchema = z.object({
  title: z.string().optional().nullable(),
  stages: z.array(stageSchema).min(1),
  status: z
    .enum(["DRAFT", "PROPOSED", "ACCEPTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"])
    .optional(),
});

@Controller()
export class VisitsIdCarePlanController {
  @UseGuards(ClinicApiGuard)
  @Get("api/visits/:id/care-plan")
  @HttpCode(200)
  async getCarePlan(@Req() httpReq: Request) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_VISITS);
      if (denied) return clinicBody(denied);
      const visitId = httpReq.params.id;
      return { carePlan: await getCarePlanForVisit(visitId) };
    });
  }

  @UseGuards(ClinicApiGuard)
  @Post("api/visits/:id/care-plan")
  @HttpCode(201)
  async createCarePlan(@Req() httpReq: Request) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      try {
        const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_VISITS);
        if (denied) return clinicBody(denied);
        const visitId = httpReq.params.id;
        const visit = await prisma.visit.findUnique({
          where: { id: visitId },
          select: { id: true, patientRefId: true, organizationId: true },
        });
        if (!visit) throw new HttpException({ error: "Visit not found" }, 404);
        const body = writeSchema.parse(httpReq.body ?? {});
        const carePlan = await upsertCarePlanForVisit({
          visitId: visit.id,
          patientRefId: visit.patientRefId,
          organizationId: visit.organizationId,
          title: body.title,
          stages: body.stages ?? DEFAULT_CARE_PLAN_STAGES,
          status: body.status ?? "DRAFT",
          createdByUserId: session.userId,
        });
        return { carePlan };
      } catch (err) {
        if (err instanceof HttpException) throw err;
        return clinicBody(handleRouteError(err));
      }
    });
  }

  @UseGuards(ClinicApiGuard)
  @Patch("api/visits/:id/care-plan")
  @HttpCode(200)
  async patchCarePlan(@Req() httpReq: Request) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      try {
        const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_VISITS);
        if (denied) return clinicBody(denied);
        const visitId = httpReq.params.id;
        const visit = await prisma.visit.findUnique({
          where: { id: visitId },
          select: { id: true, patientRefId: true, organizationId: true },
        });
        if (!visit) throw new HttpException({ error: "Visit not found" }, 404);
        const body = writeSchema.parse(httpReq.body ?? {});
        const carePlan = await upsertCarePlanForVisit({
          visitId: visit.id,
          patientRefId: visit.patientRefId,
          organizationId: visit.organizationId,
          title: body.title,
          stages: body.stages,
          status: body.status,
          createdByUserId: session.userId,
        });
        return { carePlan };
      } catch (err) {
        if (err instanceof HttpException) throw err;
        return clinicBody(handleRouteError(err));
      }
    });
  }
}