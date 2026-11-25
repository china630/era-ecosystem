import { Controller, HttpCode, Post, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { verifyGuestQrToken } from "@era/satellite-kit";
import { bakuDayBounds, todayBakuYmd } from "@/lib/baku-day";
import { findPatientRefByGlobalPersonId, listPatientProcedureOrdersForDay } from "@/domain/patient/patient.service";


const schema = z.object({
  token: z.string().min(8),
  date: z.string().optional(),
});

@Controller()
export class NurseQrScanController {

  @UseGuards(ClinicApiGuard)
  @Post("api/nurse/qr-scan")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_NURSE_QR_SCAN);
    if (denied) return clinicBody(denied);

    const body = schema.parse(httpReq.body);
    const payload = await verifyGuestQrToken(body.token.trim());
    if (!payload?.globalPersonId) {
      throw new HttpException({ error: "Invalid or expired guest QR token" }, 400);
    }

    const dayYmd = body.date?.trim() || todayBakuYmd();
    const { start: day, end: next } = bakuDayBounds(dayYmd);

    const patient = await findPatientRefByGlobalPersonId(payload.globalPersonId);
    if (!patient) throw new HttpException({ error: "Guest not registered in clinic" }, 404);

    const orders = await listPatientProcedureOrdersForDay({
      patientRefId: patient.id,
      dayStart: day,
      dayEnd: next,
    });

    return {
      globalPersonId: payload.globalPersonId,
      patientRefId: patient.id,
      patientName: patient.fullName,
      orders,
      /** Client must pass this token again on check-in (anti-fraud). */
      qrToken: body.token.trim(),
    };
  
        });
  }
}
