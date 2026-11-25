import { expressKitHeaders } from "@era/satellite-kit";
import { Controller, Delete, HttpCode, Post, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { recordClinicAudit } from "@/lib/satellite-audit";
import { createStaffAbsence, deleteStaffAbsence } from "@/domain/staff/staff-duty-roster.service";


const createSchema = z.object({
  practitionerId: z.string().min(1),
  kind: z.enum(["VACATION", "SICK", "TRAINING", "OTHER"]),
  startsOn: z.string().min(10),
  endsOn: z.string().min(10),
  note: z.string().max(200).nullable().optional(),
});

@Controller()
export class SanatoriumStaffAbsencesController {

  @UseGuards(ClinicApiGuard)
  @Post("api/sanatorium/staff-absences")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_SANATORIUM_STAFF_ABSENCES);
    if (denied) return clinicBody(denied);
    const body = createSchema.parse(httpReq.body);
    const row = await createStaffAbsence(body);
    await recordClinicAudit(
      { userId: session!.sub, request: expressKitHeaders(httpReq) },
      "staffAbsence",
      row.id,
      "CREATE",
      body,
    );
    throw new HttpException(row, 201);
  
        });
  }

  @UseGuards(ClinicApiGuard)
  @Delete("api/sanatorium/staff-absences")
  @HttpCode(200)
  async delete_1(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_SANATORIUM_STAFF_ABSENCES);
    if (denied) return clinicBody(denied);
    const id = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").searchParams.get("id");
    if (!id) {
      throw new HttpException({ error: "id required" }, 400);
    }
    await deleteStaffAbsence(id);
    await recordClinicAudit(
      { userId: session!.sub, request: expressKitHeaders(httpReq) },
      "staffAbsence",
      id,
      "DELETE",
    );
    return { deleted: true };
  
        });
  }
}
