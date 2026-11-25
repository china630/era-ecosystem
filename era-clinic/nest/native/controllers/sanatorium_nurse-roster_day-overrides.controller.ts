import { expressKitHeaders } from "../../express-kit-headers";
import { Controller, Delete, Get, HttpCode, Put, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
  clinicRoute,
} from "../../bridge";
import { z } from "zod";
import { getSatelliteSession, requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { recordClinicAudit } from "@/lib/satellite-audit";
import { readUiLocale } from "@/lib/request-locale";
import { deleteDayOverride, listDayOverrides, upsertDayOverride } from "@/domain/staff/staff-duty-roster.service";


const staffKindSchema = z.enum(["NURSE", "LAB"]).default("NURSE");

const upsertSchema = z.object({
  yearMonth: z.string(),
  staffKind: staffKindSchema.optional(),
  dutyDate: z.string().min(10),
  procedureTypeId: z.string().min(1),
  practitionerId: z.string().min(1),
  note: z.string().max(200).nullable().optional(),
});

async function rosterForbidden(
  session: Awaited<ReturnType<typeof getSatelliteSession>>,
) {
  return requireClinicPermission(session, CLINIC_PERMISSION.API_SANATORIUM_NURSE_ROSTER);
}

@Controller()
export class SanatoriumNurseRosterDayOverridesController {

  @UseGuards(ClinicApiGuard)
  @Get("api/sanatorium/nurse-roster/day-overrides")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await rosterForbidden(session);
    if (denied) return clinicBody(denied);
    const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    const yearMonth = url.searchParams.get("yearMonth") ?? "";
    const staffKindRaw = url.searchParams.get("staffKind") ?? "NURSE";
    const dutyDate = url.searchParams.get("dutyDate") ?? undefined;
    const locale = await readUiLocale(clinicRoute(httpReq));
    return await listDayOverrides({
        yearMonth,
        staffKind: staffKindRaw === "LAB" ? "LAB" : "NURSE",
        dutyDate,
        locale,
      });
  
        });
  }

  @UseGuards(ClinicApiGuard)
  @Put("api/sanatorium/nurse-roster/day-overrides")
  @HttpCode(200)
  async put_1(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await rosterForbidden(session);
    if (denied) return clinicBody(denied);
    const body = upsertSchema.parse(httpReq.body);
    const row = await upsertDayOverride({
      ...body,
      createdByUserId: session!.sub,
    });
    await recordClinicAudit(
      { userId: session!.sub, request: expressKitHeaders(httpReq) },
      "staffDutyDayOverride",
      row.id,
      "UPSERT",
      {
        yearMonth: body.yearMonth,
        dutyDate: body.dutyDate,
        procedureTypeId: body.procedureTypeId,
        practitionerId: body.practitionerId,
      },
    );
    return row;
  
        });
  }

  @UseGuards(ClinicApiGuard)
  @Delete("api/sanatorium/nurse-roster/day-overrides")
  @HttpCode(200)
  async delete_2(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await rosterForbidden(session);
    if (denied) return clinicBody(denied);
    const id = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").searchParams.get("id");
    if (!id) {
      throw new HttpException({ error: "id required" }, 400);
    }
    await deleteDayOverride(id);
    await recordClinicAudit(
      { userId: session!.sub, request: expressKitHeaders(httpReq) },
      "staffDutyDayOverride",
      id,
      "DELETE",
    );
    return { deleted: true };
  
        });
  }
}
