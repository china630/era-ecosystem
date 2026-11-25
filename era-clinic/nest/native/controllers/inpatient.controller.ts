import { Controller, Get, HttpCode, Post, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { handleRouteError, requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import {
  admitPatient,
  dischargeAdmission,
  listInpatientCensus,
  listRegisteredAdmissions,
  listWardsWithPatients,
  refuseAdmission,
  registerAdmission,
  transferAdmission,
} from "@/domain/inpatient/adt.service";


const admissionMetaSchema = z.object({
  admissionKind: z.enum(["PLANNED", "EMERGENCY"]).optional(),
  source: z.enum(["SELF", "REFERRAL", "AMBULANCE", "TRANSFER", "ITS_REFERRAL"]).optional(),
  referralRef: z.string().optional(),
  departmentId: z.string().optional(),
  attendingPractitionerId: z.string().optional(),
});

const admitSchema = z
  .object({
    action: z
      .enum(["admit", "register", "refuse", "transfer", "discharge"])
      .optional(),
    bedId: z.string().optional(),
    patientRefId: z.string().optional(),
    admissionId: z.string().optional(),
    newBedId: z.string().optional(),
    refusalReason: z.string().optional(),
    transferReason: z.string().optional(),
    outcome: z
      .enum([
        "RECOVERED",
        "IMPROVED",
        "UNCHANGED",
        "WORSENED",
        "TRANSFERRED",
        "DIED",
        "SELF_DISCHARGE",
      ])
      .optional(),
  })
  .merge(admissionMetaSchema);

@Controller()
export class InpatientController {

  @UseGuards(ClinicApiGuard)
  @Get("api/inpatient")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_INPATIENT_READ);
    if (denied) return clinicBody(denied);

        const view = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").searchParams.get("view");
    if (view === "census") {
      return { items: await listInpatientCensus() };
    }
    if (view === "registered") {
      return { items: await listRegisteredAdmissions() };
    }
    const wards = await listWardsWithPatients();
    return { wards };
  
        });
  }

  @UseGuards(ClinicApiGuard)
  @Post("api/inpatient")
  @HttpCode(200)
  async post_1(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      try {
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_INPATIENT);
    if (denied) return clinicBody(denied);

        const body = admitSchema.parse(httpReq.body);
    const action = body.action ?? "admit";

    if (action === "register") {
      if (!body.patientRefId) {
        throw new HttpException({ error: "patientRefId required" }, 400);
      }
      const admission = await registerAdmission({
        patientRefId: body.patientRefId,
        admissionKind: body.admissionKind,
        source: body.source,
        referralRef: body.referralRef,
        departmentId: body.departmentId,
        attendingPractitionerId: body.attendingPractitionerId,
      });
      return { admission };
    }

    if (action === "refuse") {
      if (!body.admissionId || !body.refusalReason?.trim()) {
        throw new HttpException({ error: "admissionId and refusalReason required" }, 400);
      }
      const admission = await refuseAdmission(body.admissionId, body.refusalReason);
      return { admission };
    }

    if (action === "admit") {
      if (!body.bedId) {
        throw new HttpException({ error: "bedId required" }, 400);
      }
      if (!body.patientRefId && !body.admissionId) {
        throw new HttpException({ error: "patientRefId or admissionId required" }, 400);
      }
      const result = await admitPatient({
        patientRefId: body.patientRefId ?? "",
        bedId: body.bedId,
        admissionId: body.admissionId,
        admissionKind: body.admissionKind,
        source: body.source,
        referralRef: body.referralRef,
        departmentId: body.departmentId,
        attendingPractitionerId: body.attendingPractitionerId,
      });
      throw new HttpException(result, 201);
    }
    if (action === "transfer") {
      if (!body.admissionId || !body.newBedId) {
        throw new HttpException({ error: "admissionId and newBedId required" }, 400);
      }
      const assignment = await transferAdmission(body.admissionId, body.newBedId, {
        byUserId: session.userId,
        reason: body.transferReason,
      });
      return { assignment };
    }
    if (action === "discharge") {
      if (!body.admissionId) throw new HttpException({ error: "admissionId required" }, 400);
      const admission = await dischargeAdmission(body.admissionId, body.outcome);
      return { admission };
    }
    throw new HttpException({ error: "Unknown action" }, 400);
  } catch (err) {
    if (err instanceof HttpException) throw err;
    const msg = err instanceof Error ? err.message : "Failed";
    if (msg.includes("occupied") || msg.includes("not available")) {
      throw new HttpException({ error: msg }, 409);
    }
    return clinicBody(handleRouteError(err));
  }

        });
  }
}