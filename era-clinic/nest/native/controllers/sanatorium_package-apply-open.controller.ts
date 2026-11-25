import { Controller, HttpCode, Post, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
} from "../../bridge";
import { isPlatformSuperAdminUser } from "@/lib/auth/platform-super-admin";
import { applyPackageAutoBlocks } from "@/domain/sanatorium/package-auto-apply.service";
import { listOpenEpisodesForPackageApplyRetry } from "@/domain/sanatorium/package-assign.service";


/**
 * Super-admin: re-apply the current package version on every OPEN course that already has a program.
 * Closed courses are left alone; they pick up the current template when opened.
 */

@Controller()
export class SanatoriumPackageApplyOpenController {

  @UseGuards(ClinicApiGuard)
  @Post("api/sanatorium/package-apply-open")
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

    const episodes = await listOpenEpisodesForPackageApplyRetry();

    let updated = 0;
    const failed: Array<{ id: string; name: string }> = [];
    for (const episode of episodes) {
      try {
        await applyPackageAutoBlocks(episode.id, { trigger: "MANUAL_RETRY" });
        updated += 1;
      } catch {
        failed.push({
          id: episode.id,
          name: episode.patientRef?.fullName?.trim() || episode.id,
        });
      }
    }
    return { updated, failed };
  
        });
  }
}
