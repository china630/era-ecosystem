import { Controller, HttpCode, Post, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
} from "../../bridge";
import { z } from "zod";
import { isPlatformSuperAdminUser } from "@/lib/auth/platform-super-admin";
import { applyScheduleRecalc, previewScheduleRecalc } from "@/domain/planning/recalculate-schedule";


const bodySchema = z.object({
  apply: z.boolean().default(false),
  episodeId: z.string().optional(),
});

/** Bulk schedule moves — platform super-admin only (not CLINIC_ADMIN / settings). */

@Controller()
export class AdminScheduleRecalcController {

  @UseGuards(ClinicApiGuard)
  @Post("api/admin/schedule-recalc")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      if (!session) throw new HttpException({ error: "Unauthorized" }, 401);
    if (!isPlatformSuperAdminUser({ email: session.email, login: session.login })) {
      throw new HttpException({ error: "Forbidden" }, 403);
    }
    const body = bodySchema.parse(httpReq.body);
    const moves = body.apply
      ? await applyScheduleRecalc(body.episodeId)
      : await previewScheduleRecalc(body.episodeId);
    return { moves };
  
        });
  }
}
