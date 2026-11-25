import { Controller, HttpCode, Patch, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { callQueueTicket } from "@/domain/appointment/appointment-calendar.service";


const patchSchema = z.object({
  desk: z.string().optional(),
});

@Controller()
export class QueueTicketsIdCallController {

  @UseGuards(ClinicApiGuard)
  @Patch("api/queue/tickets/:id/call")
  @HttpCode(200)
  async patch_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_QUEUE);
    if (denied) return clinicBody(denied);

    const { id } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);
    const result = await callQueueTicket(id, body.desk);
    if (result.kind === "not_found") throw new HttpException({ error: "Queue ticket not found" }, 404);
    if (result.kind === "bad_status") {
      throw new HttpException({ error: `Cannot call ticket in status ${result.status}` }, 400);
    }
    return result.ticket;
  
        });
  }
}
