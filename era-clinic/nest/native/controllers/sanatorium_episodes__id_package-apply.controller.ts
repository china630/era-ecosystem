import { Controller, HttpCode, Post, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { assertEpisodeDataScope } from "@/lib/auth/clinic-data-scope";
import { applyPackageAutoBlocks } from "@/domain/sanatorium/package-auto-apply.service";
import { findEpisodePatientDisplayName } from "@/domain/sanatorium/episode-resolve";


/**
 * Super-admin: move the course onto the current package version, then create missing auto visits and labs.
 * Permission: api:procedures.confirm
 */

@Controller()
export class SanatoriumEpisodesIdPackageApplyController {

  @UseGuards(ClinicApiGuard)
  @Post("api/sanatorium/episodes/:id/package-apply")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {


  const { id } = httpReq.params;
  try {
    if (!session) throw new HttpException({ error: "Unauthorized" }, 401);
    // Card "recalculate this course" — procedures.confirm OR patient write.
    const confirmDenied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_PROCEDURES_CONFIRM,
    );
    if (confirmDenied) {
      const patientDenied = await requireClinicPermission(
        session,
        CLINIC_PERMISSION.API_PATIENTS,
      );
      if (patientDenied) return confirmDenied;
    }
    const scopeDenied = await assertEpisodeDataScope(session, id);
    if (scopeDenied) return clinicBody(scopeDenied);

    const result = await applyPackageAutoBlocks(id, {
      trigger: "MANUAL_RETRY",
      auditCtx: { userId: session.sub },
    });
    return result;
  } catch (err) {
    if (err instanceof HttpException) throw err;
    if (err instanceof Error) {
      const name = await findEpisodePatientDisplayName(id);
      if (name && !err.message.startsWith(name)) {
        err.message = `${name}: ${err.message}`;
      }
    }
    return clinicBody(handleRouteError(err));
  }

        });
  }
}
