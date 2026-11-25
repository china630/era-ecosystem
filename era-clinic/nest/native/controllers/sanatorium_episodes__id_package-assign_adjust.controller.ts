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
import { assertEpisodeDataScope } from "@/lib/auth/clinic-data-scope";
import { PackageAssignError, adjustPackageAssign } from "@/domain/sanatorium/package-assign.service";


const adjustSchema = z.object({
  procedureCode: z.string().min(1),
  assignBatchId: z.string().optional().nullable(),
  targetActiveQty: z.number().int().min(0).optional(),
  cancelAllActive: z.boolean().optional(),
  cancelOrderIds: z.array(z.string().min(1)).max(80).optional(),
});

@Controller()
export class SanatoriumEpisodesIdPackageAssignAdjustController {

  @UseGuards(ClinicApiGuard)
  @Post("api/sanatorium/episodes/:id/package-assign/adjust")
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
      CLINIC_PERMISSION.API_PROCEDURES_CONFIRM,
    );
    if (denied) return clinicBody(denied);
    const { id } = httpReq.params;
    const scopeDenied = await assertEpisodeDataScope(session, id);
    if (scopeDenied) return clinicBody(scopeDenied);
    const body = adjustSchema.parse(httpReq.body);
    const result = await adjustPackageAssign(id, body);
    return result;
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
