import { expressKitHeaders } from "@era/satellite-kit";
import { Controller, Get, HttpCode, Post, Put, Req, UseGuards } from "@nestjs/common";
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
import { approveDutyRoster, copyDutyRosterFromPrevious, getOrCreateDutyRoster, saveDutyRoster } from "@/domain/staff/staff-duty-roster.service";


const staffKindSchema = z.enum(["NURSE", "LAB"]).default("NURSE");

const saveSchema = z.object({
  yearMonth: z.string(),
  staffKind: staffKindSchema.optional(),
  note: z.string().max(500).nullable().optional(),
  lines: z.array(
    z.object({
      procedureTypeId: z.string().min(1),
      practitionerId: z.string().nullable().optional(),
      stable: z.boolean().optional(),
      note: z.string().max(200).nullable().optional(),
    }),
  ),
});

const monthSchema = z.object({
  yearMonth: z.string(),
  staffKind: staffKindSchema.optional(),
});

async function rosterForbidden(
  session: Awaited<ReturnType<typeof getSatelliteSession>>,
) {
  return requireClinicPermission(session, CLINIC_PERMISSION.API_SANATORIUM_NURSE_ROSTER);
}

@Controller()
export class SanatoriumNurseRosterController {

  @UseGuards(ClinicApiGuard)
  @Get("api/sanatorium/nurse-roster")
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
    const parsed = monthSchema.parse({
      yearMonth,
      staffKind: staffKindRaw === "LAB" ? "LAB" : "NURSE",
    });
    const locale = await readUiLocale(clinicRoute(httpReq));
    return await getOrCreateDutyRoster({ ...parsed, locale });
  
        });
  }

  @UseGuards(ClinicApiGuard)
  @Put("api/sanatorium/nurse-roster")
  @HttpCode(200)
  async put_1(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await rosterForbidden(session);
    if (denied) return clinicBody(denied);
    const body = saveSchema.parse(httpReq.body);
    const locale = await readUiLocale(clinicRoute(httpReq));
    const result = await saveDutyRoster({ ...body, locale });
    await recordClinicAudit(
      { userId: session!.sub, request: expressKitHeaders(httpReq) },
      "staffDutyRoster",
      result.roster.id,
      "UPDATE",
      { yearMonth: body.yearMonth, lines: body.lines.length },
    );
    return result;
  
        });
  }

  @UseGuards(ClinicApiGuard)
  @Post("api/sanatorium/nurse-roster")
  @HttpCode(200)
  async post_2(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await rosterForbidden(session);
    if (denied) return clinicBody(denied);
    const body = z
      .object({
        action: z.enum(["approve", "copyPrevious"]),
        yearMonth: z.string(),
        staffKind: staffKindSchema.optional(),
      })
      .parse(httpReq.body);

    const locale = await readUiLocale(clinicRoute(httpReq));
    if (body.action === "copyPrevious") {
      const result = await copyDutyRosterFromPrevious({ ...body, locale });
      await recordClinicAudit(
        { userId: session!.sub, request: expressKitHeaders(httpReq) },
        "staffDutyRoster",
        result.roster.id,
        "COPY_PREVIOUS",
        { yearMonth: body.yearMonth },
      );
      return result;
    }

    const result = await approveDutyRoster({
      yearMonth: body.yearMonth,
      staffKind: body.staffKind,
      locale,
      approvedByUserId: session!.sub,
    });
    await recordClinicAudit(
      { userId: session!.sub, request: expressKitHeaders(httpReq) },
      "staffDutyRoster",
      result.roster.id,
      "APPROVE",
      { yearMonth: body.yearMonth },
    );
    return result;
  
        });
  }
}
