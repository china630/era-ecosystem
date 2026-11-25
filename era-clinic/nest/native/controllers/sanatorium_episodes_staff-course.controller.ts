import { Controller, HttpCode, Post, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import { withClinicStaff, clinicBody } from "../../bridge";
import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { requestOrganizationId } from "@/lib/request-organization";
import {
  openStaffBenefitCourse,
  StaffBenefitCourseError,
} from "@/domain/sanatorium/staff-benefit-course.service";

const bodySchema = z.object({
  cpEmploymentId: z.string().min(1),
  courseDays: z.coerce.number().int().min(1).max(31),
  startsOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  programCode: z.string().optional(),
});

@Controller()
export class SanatoriumEpisodesStaffCourseController {
  @UseGuards(ClinicApiGuard)
  @Post("api/sanatorium/episodes/staff-course")
  @HttpCode(201)
  async post_0(@Req() httpReq: Request) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      if (!session) throw new HttpException({ error: "Unauthorized" }, 401);
      const denied = await requireClinicPermission(
        session,
        CLINIC_PERMISSION.API_SANATORIUM_EPISODES_WRITE,
      );
      if (denied) return clinicBody(denied);

      let organizationId: string;
      try {
        const id = requestOrganizationId();
        organizationId = id === "demo-org" ? session.organizationId : id;
      } catch {
        organizationId = session.organizationId;
      }

      const body = bodySchema.parse(httpReq.body ?? {});
      try {
        const result = await openStaffBenefitCourse({
          organizationId,
          cpEmploymentId: body.cpEmploymentId,
          courseDays: body.courseDays,
          startsOnYmd: body.startsOn,
          programCode: body.programCode,
          openedByUserId: session.sub,
        });
        return result;
      } catch (err) {
        if (err instanceof StaffBenefitCourseError) {
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
