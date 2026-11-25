import { Controller, Get, HttpCode, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
  clinicRoute,
} from "../../bridge";
import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { getPatientTimeline, type TimelineEventType } from "@/domain/patient/patient-timeline.service";
import { findPatientRefId } from "@/domain/patient/patient.service";
import { readUiLocale } from "@/lib/request-locale";


const querySchema = z.object({
  types: z.string().optional(),
  limitDays: z.coerce.number().int().min(1).max(365).optional(),
});

const TYPE_SET = new Set<TimelineEventType>([
  "appointment",
  "visit",
  "lab_order",
  "procedure",
  "episode",
]);

@Controller()
export class PatientsIdTimelineController {

  @UseGuards(ClinicApiGuard)
  @Get("api/patients/:id/timeline")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PATIENTS_READ);
    if (denied) return clinicBody(denied);

        const { id } = httpReq.params;
    if (!(await findPatientRefId(id))) throw new HttpException({ error: "Not found" }, 404);

    const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    const query = querySchema.parse({
      types: url.searchParams.get("types") ?? undefined,
      limitDays: url.searchParams.get("limitDays") ?? undefined,
    });
    const types = query.types
      ? (query.types
          .split(",")
          .map((t) => t.trim())
          .filter((t): t is TimelineEventType => TYPE_SET.has(t as TimelineEventType)) as TimelineEventType[])
      : undefined;

    return await getPatientTimeline(id, {
        types: types?.length ? types : undefined,
        limitDays: query.limitDays,
        locale: await readUiLocale(clinicRoute(httpReq)),
      });
  
        });
  }
}
