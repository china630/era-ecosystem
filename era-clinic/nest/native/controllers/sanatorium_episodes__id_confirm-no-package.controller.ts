import { Controller, Delete, HttpCode, Post, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { assertEpisodeDataScope } from "@/lib/auth/clinic-data-scope";
import { clearEpisodeNoPackageConfirm, confirmEpisodeNoPackage } from "@/domain/sanatorium/episode-resolve";


/**
 * Ops signal: guest confirmed to have no medical package on this course.
 */


/**
 * Undo the signal — the package arrived (or was confirmed by mistake), so
 * entitlement pricing takes over again instead of billing everything at list price.
 */

@Controller()
export class SanatoriumEpisodesIdConfirmNoPackageController {

  @UseGuards(ClinicApiGuard)
  @Post("api/sanatorium/episodes/:id/confirm-no-package")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {


  
    if (!session) throw new HttpException({ error: "Unauthorized" }, 401);
    const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_SANATORIUM_EPISODES_WRITE,
    );
    if (denied) return clinicBody(denied);
    const { id } = httpReq.params;
    const scopeDenied = await assertEpisodeDataScope(session, id);
    if (scopeDenied) return clinicBody(scopeDenied);

    const result = await confirmEpisodeNoPackage(id, session.sub);
    if (!result.ok) {
      if (result.kind === "NOT_FOUND") throw new HttpException({ error: "Episode not found" }, 404);
      throw new HttpException({ error: "Episode is closed", ...{ code: "EPISODE_CLOSED" } }, 409);
    }
    return result.row;
  
        });
  }

  @UseGuards(ClinicApiGuard)
  @Delete("api/sanatorium/episodes/:id/confirm-no-package")
  @HttpCode(200)
  async delete_1(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {


  
    if (!session) throw new HttpException({ error: "Unauthorized" }, 401);
    const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_SANATORIUM_EPISODES_WRITE,
    );
    if (denied) return clinicBody(denied);
    const { id } = httpReq.params;
    const scopeDenied = await assertEpisodeDataScope(session, id);
    if (scopeDenied) return clinicBody(scopeDenied);

    const updated = await clearEpisodeNoPackageConfirm(id);
    if (!updated) throw new HttpException({ error: "Episode not found" }, 404);
    return updated;
  
        });
  }
}
