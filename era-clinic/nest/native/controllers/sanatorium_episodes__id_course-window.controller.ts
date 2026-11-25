import { Controller, HttpCode, Patch, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import { withClinicStaff, clinicBody } from "../../bridge";
import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { assertEpisodeDataScope } from "@/lib/auth/clinic-data-scope";
import {
  CourseWindowError,
  patchCourseWindow,
} from "@/domain/sanatorium/course-window.service";

const bodySchema = z.object({
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

@Controller()
export class SanatoriumEpisodesIdCourseWindowController {
  @UseGuards(ClinicApiGuard)
  @Patch("api/sanatorium/episodes/:id/course-window")
  @HttpCode(200)
  async patch_0(@Req() httpReq: Request) {
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

      const body = bodySchema.parse(httpReq.body ?? {});
      try {
        return await patchCourseWindow({ episodeId: id, endsOnYmd: body.endsOn });
      } catch (err) {
        if (err instanceof CourseWindowError) {
          throw new HttpException(
            { error: err.message, code: err.code },
            err.status,
          );
        }
        throw err;
      }
    });
  }
}
