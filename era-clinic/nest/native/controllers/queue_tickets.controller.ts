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
import { findVisitById, findActiveQueueTicketForVisit, createQueueTicket } from "@/domain/appointment/appointment-calendar.service";


const createSchema = z.object({
  visitId: z.string(),
  desk: z.string().optional(),
});

@Controller()
export class QueueTicketsController {

  @UseGuards(ClinicApiGuard)
  @Post("api/queue/tickets")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_QUEUE);
    if (denied) return clinicBody(denied);

    const body = createSchema.parse(httpReq.body);
    const visit = await findVisitById(body.visitId);
    if (!visit) throw new HttpException({ error: "Visit not found" }, 404);

    const existing = await findActiveQueueTicketForVisit(body.visitId);
    if (existing) return existing;

    const ticket = await createQueueTicket({
      visitId: body.visitId,
      desk: body.desk,
    });
    throw new HttpException(ticket, 201);
  
        });
  }
}
