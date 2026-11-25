import { Controller, Get, HttpCode, Post, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import { withClinicStaff, clinicBody } from "../../bridge";
import { z } from "zod";
import { handleRouteError, requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import {
  listRiskAssessmentsForAdmission,
  listVitalsForAdmission,
  recordRiskAssessment,
  recordVital,
} from "@/domain/inpatient/vitals.service";
import { prisma } from "@/lib/prisma";

const vitalSchema = z.object({
  kind: z.enum([
    "TEMP",
    "BP_SYS",
    "BP_DIA",
    "PULSE",
    "RESP",
    "SPO2",
    "WEIGHT",
    "HEIGHT",
    "PAIN",
    "GLUCOSE",
  ]),
  value: z.number(),
  unit: z.string().min(1),
  measuredAt: z.string().datetime().optional(),
});

const riskSchema = z.object({
  scale: z.enum(["MORSE", "WATERLOW", "NEWS2", "VAS"]),
  score: z.number().int().min(0),
  answers: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

@Controller()
export class VitalsController {
  @UseGuards(ClinicApiGuard)
  @Get("api/inpatient/:id/vitals")
  @HttpCode(200)
  async listVitals(@Req() httpReq: Request) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_INPATIENT_READ);
      if (denied) return clinicBody(denied);
      const admissionId = httpReq.params.id;
      return { items: await listVitalsForAdmission(admissionId) };
    });
  }

  @UseGuards(ClinicApiGuard)
  @Post("api/inpatient/:id/vitals")
  @HttpCode(201)
  async postVital(@Req() httpReq: Request) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      try {
        const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_INPATIENT);
        if (denied) return clinicBody(denied);
        const admissionId = httpReq.params.id;
        const admission = await prisma.inpatientAdmission.findUnique({
          where: { id: admissionId },
          select: { patientRefId: true, status: true },
        });
        if (!admission || admission.status !== "ADMITTED") {
          throw new HttpException({ error: "Admission not active" }, 404);
        }
        const body = vitalSchema.parse(httpReq.body);
        const row = await recordVital({
          patientRefId: admission.patientRefId,
          admissionId,
          kind: body.kind,
          value: body.value,
          unit: body.unit,
          measuredAt: body.measuredAt ? new Date(body.measuredAt) : undefined,
          byUserId: session.userId,
        });
        return { vital: row };
      } catch (err) {
        if (err instanceof HttpException) throw err;
        return clinicBody(handleRouteError(err));
      }
    });
  }

  @UseGuards(ClinicApiGuard)
  @Get("api/inpatient/:id/risk-assessments")
  @HttpCode(200)
  async listRisk(@Req() httpReq: Request) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_INPATIENT_READ);
      if (denied) return clinicBody(denied);
      const admissionId = httpReq.params.id;
      return { items: await listRiskAssessmentsForAdmission(admissionId) };
    });
  }

  @UseGuards(ClinicApiGuard)
  @Post("api/inpatient/:id/risk-assessments")
  @HttpCode(201)
  async postRisk(@Req() httpReq: Request) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      try {
        const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_INPATIENT);
        if (denied) return clinicBody(denied);
        const admissionId = httpReq.params.id;
        const body = riskSchema.parse(httpReq.body);
        const row = await recordRiskAssessment({
          admissionId,
          scale: body.scale,
          score: body.score,
          answers: body.answers ?? {},
          byUserId: session.userId,
        });
        return { assessment: row };
      } catch (err) {
        if (err instanceof HttpException) throw err;
        return clinicBody(handleRouteError(err));
      }
    });
  }
}