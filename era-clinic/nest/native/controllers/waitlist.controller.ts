import { Controller, Get, HttpCode, Post, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import { withClinicStaff, clinicBody } from "../../bridge";
import { z } from "zod";
import { handleRouteError, requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { createWaitlistEntry, listWaitlistEntries } from "@/domain/appointment/waitlist.service";
import { requestOrganizationId } from "@/lib/request-organization";

const createSchema = z.object({
  patientRefId: z.string().min(1),
  serviceCode: z.string().optional().nullable(),
  practitionerId: z.string().optional().nullable(),
  preferredFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  preferredTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  notes: z.string().optional().nullable(),
});

@Controller()
export class WaitlistController {
  @UseGuards(ClinicApiGuard)
  @Get("api/waitlist")
  @HttpCode(200)
  async list(@Req() httpReq: Request) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_APPOINTMENTS_READ);
      if (denied) return clinicBody(denied);
      return { items: await listWaitlistEntries() };
    });
  }

  @UseGuards(ClinicApiGuard)
  @Post("api/waitlist")
  @HttpCode(201)
  async create(@Req() httpReq: Request) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      try {
        const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_APPOINTMENTS_WRITE);
        if (denied) return clinicBody(denied);
        const body = createSchema.parse(httpReq.body);
        const row = await createWaitlistEntry({
          organizationId: requestOrganizationId(),
          ...body,
        });
        return { entry: row };
      } catch (err) {
        if (err instanceof HttpException) throw err;
        return clinicBody(handleRouteError(err));
      }
    });
  }
}