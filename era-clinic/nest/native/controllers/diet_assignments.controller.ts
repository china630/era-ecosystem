import { Controller, Get, HttpCode, Post, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import { withClinicStaff, clinicBody } from "../../bridge";
import { z } from "zod";
import { handleRouteError, requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { assignDiet, listDietAssignmentsForScope } from "@/domain/diet/diet.service";
import { requestOrganizationId } from "@/lib/request-organization";

const assignSchema = z.object({
  dietTableId: z.string().min(1),
  clinicalEpisodeId: z.string().optional(),
  admissionId: z.string().optional(),
  assignedFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  assignedTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  assignedByPractitionerId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

@Controller()
export class DietAssignmentsController {
  @UseGuards(ClinicApiGuard)
  @Get("api/diet-assignments")
  @HttpCode(200)
  async list(@Req() httpReq: Request) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_INPATIENT_READ);
      if (denied) return clinicBody(denied);
      const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const clinicalEpisodeId = url.searchParams.get("clinicalEpisodeId") ?? undefined;
      const admissionId = url.searchParams.get("admissionId") ?? undefined;
      return {
        items: await listDietAssignmentsForScope({ clinicalEpisodeId, admissionId }),
      };
    });
  }

  @UseGuards(ClinicApiGuard)
  @Post("api/diet-assignments")
  @HttpCode(201)
  async post(@Req() httpReq: Request) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      try {
        const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_INPATIENT);
        if (denied) return clinicBody(denied);
        const body = assignSchema.parse(httpReq.body);
        if (!body.clinicalEpisodeId && !body.admissionId) {
          throw new HttpException({ error: "clinicalEpisodeId or admissionId required" }, 400);
        }
        const row = await assignDiet({
          organizationId: requestOrganizationId(),
          ...body,
        });
        return { assignment: row };
      } catch (err) {
        if (err instanceof HttpException) throw err;
        return clinicBody(handleRouteError(err));
      }
    });
  }
}