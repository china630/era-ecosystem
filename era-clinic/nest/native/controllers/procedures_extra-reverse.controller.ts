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
import { cancelPaidExtraWithFolioReverse } from "@/domain/sanatorium/extras-assign.service";
import { PackageAssignError } from "@/domain/sanatorium/package-assign.service";


const schema = z.object({
  orderId: z.string().min(1),
});

/** CLI-57 W4 — clinic reception reverse paid not-COMPLETED extra (−folio). */

@Controller()
export class ProceduresExtraReverseController {

  @UseGuards(ClinicApiGuard)
  @Post("api/procedures/extra-reverse")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      try {
    if (!session) throw new HttpException({ error: "Unauthorized" }, 401);
    const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_PROCEDURES_ISSUE_TICKET_WRITE,
    );
    if (denied) return clinicBody(denied);
    const body = schema.parse(httpReq.body);
    const reversed = await cancelPaidExtraWithFolioReverse(body.orderId, session.sub);
    return { ok: true, ...reversed };
  } catch (err) {
    if (err instanceof HttpException) throw err;
    if (err instanceof PackageAssignError) {
      throw new HttpException({ error: err.message, ...{ code: err.code } }, err.status);
    }
    return clinicBody(handleRouteError(err));
  }

        });
  }
}
