import { Controller, HttpCode, Post, Req, Res, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
} from "../../bridge";
import { z } from "zod";
import { isPlatformSuperAdminUser } from "@/lib/auth/platform-super-admin";
import { applyReseatFuturePlan, previewReseatFuturePlan } from "@/domain/planning/reseat-schedule";


const bodySchema = z.object({
  apply: z.boolean().default(false),
  episodeId: z.string().min(1).optional(),
  orderIds: z.array(z.string().min(1)).optional(),
  allOpenOverlaps: z.boolean().optional(),
  allOpenClosedDays: z.boolean().optional(),
  closedDaysOnly: z.boolean().optional(),
});

/** Bulk reseat — platform super-admin only (not CLINIC_ADMIN / settings). */

@Controller()
export class AdminScheduleReseatController {

  @UseGuards(ClinicApiGuard)
  @Post("api/admin/schedule-reseat")
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
    if (
      !body.allOpenOverlaps &&
      !body.allOpenClosedDays &&
      !body.closedDaysOnly &&
      !body.episodeId &&
      !(body.orderIds ?? []).length
    ) {
      throw new HttpException({ error: "episodeId, orderIds, allOpenOverlaps, or allOpenClosedDays required" }, 400);
    }
    const result = body.apply ? await applyReseatFuturePlan(body) : await previewReseatFuturePlan(body);
    return result;
  
        });
  }
}
