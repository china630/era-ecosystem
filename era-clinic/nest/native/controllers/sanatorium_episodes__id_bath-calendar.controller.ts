import { Controller, Get, HttpCode, Post, Req, Res, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { assertEpisodeDataScope } from "@/lib/auth/clinic-data-scope";
import { getBathCalendar, saveBathCalendar } from "@/domain/planning/bath-calendar.service";


const bodySchema = z.object({
  procedureCode: z.string().min(1),
  mode: z.string().regex(/^[0-9A-Z_]{1,16}$/),
  qty: z.number().int().min(0).max(60),
  manualRestYmds: z.array(z.string()).default([]),
  manualBathYmds: z.array(z.string()).default([]),
  bathSequence: z.enum(["SITZ_THEN_FULL"]).nullable().optional(),
});

@Controller()
export class SanatoriumEpisodesIdBathCalendarController {

  @UseGuards(ClinicApiGuard)
  @Get("api/sanatorium/episodes/:id/bath-calendar")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      if (!session) throw new HttpException({ error: "Unauthorized" }, 401);
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PROCEDURES_CONFIRM);
    if (denied) return clinicBody(denied);
    const { id } = httpReq.params;
    const scopeDenied = await assertEpisodeDataScope(session, id);
    if (scopeDenied) return clinicBody(scopeDenied);
    return await getBathCalendar(id);
  
        });
  }

  @UseGuards(ClinicApiGuard)
  @Post("api/sanatorium/episodes/:id/bath-calendar")
  @HttpCode(200)
  async post_1(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      if (!session) throw new HttpException({ error: "Unauthorized" }, 401);
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PROCEDURES_CONFIRM);
    if (denied) return clinicBody(denied);
    const { id } = httpReq.params;
    const scopeDenied = await assertEpisodeDataScope(session, id);
    if (scopeDenied) return clinicBody(scopeDenied);
    const body = bodySchema.parse(httpReq.body);
    return await saveBathCalendar({ episodeId: id, ...body });
  
        });
  }
}
