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
import { cancelVisit } from "@/domain/visit/visit.service";


const schema = z.object({ reason: z.string().min(1).max(500) });

@Controller()
export class VisitsIdCancelController {

  @UseGuards(ClinicApiGuard)
  @Post("api/visits/:id/cancel")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {


  try {
    if (!session) throw new HttpException({ error: "Unauthorized" }, 401);
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_VISITS);
    if (denied) return clinicBody(denied);

    const { id } = httpReq.params;
    const body = schema.parse(httpReq.body);
    const visit = await cancelVisit(id, body.reason, session.sub);
    return { visit };
  } catch (err) {
    if (err instanceof HttpException) throw err;
    const msg = err instanceof Error ? err.message : "Cancel failed";
    if (msg.includes("Cannot cancel") || msg.includes("not found")) {
      throw new HttpException({ error: msg }, 400);
    }
    return clinicBody(handleRouteError(err));
  }

        });
  }
}
