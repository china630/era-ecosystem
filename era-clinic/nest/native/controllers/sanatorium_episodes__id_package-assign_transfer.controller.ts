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
import { PackageAssignError, transferBathQuota } from "@/domain/sanatorium/package-assign.service";


const schema = z.object({
  fromCode: z.string().min(1),
  toCode: z.string().min(1),
  qty: z.number().int().positive().max(40),
  reason: z.string().min(7).max(2000),
});

@Controller()
export class SanatoriumEpisodesIdPackageAssignTransferController {

  @UseGuards(ClinicApiGuard)
  @Post("api/sanatorium/episodes/:id/package-assign/transfer")
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
    const body = schema.parse(httpReq.body);
    const result = await transferBathQuota(id, body);
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
