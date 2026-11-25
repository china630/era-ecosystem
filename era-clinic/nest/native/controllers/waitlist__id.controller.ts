import { Controller, HttpCode, Patch, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import { withClinicStaff, clinicBody } from "../../bridge";
import { z } from "zod";
import { handleRouteError, requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { patchWaitlistEntry } from "@/domain/appointment/waitlist.service";

const patchSchema = z
  .object({
    status: z.enum(["OPEN", "OFFERED", "BOOKED", "CANCELLED"]).optional(),
    notes: z.string().nullable().optional(),
    practitionerId: z.string().nullable().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "empty patch" });

@Controller()
export class WaitlistIdController {
  @UseGuards(ClinicApiGuard)
  @Patch("api/waitlist/:id")
  @HttpCode(200)
  async patch(@Req() httpReq: Request) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      try {
        const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_APPOINTMENTS_WRITE);
        if (denied) return clinicBody(denied);
        const body = patchSchema.parse(httpReq.body);
        const row = await patchWaitlistEntry(httpReq.params.id, body);
        return { entry: row };
      } catch (err) {
        if (err instanceof HttpException) throw err;
        return clinicBody(handleRouteError(err));
      }
    });
  }
}