import { Controller, Get, HttpCode, Patch, Post, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import { withClinicStaff, clinicBody } from "../../bridge";
import { z } from "zod";
import { handleRouteError, requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import {
  createInpatientOrder,
  listOrdersForAdmission,
  markAdministration,
  stopInpatientOrder,
} from "@/domain/inpatient/inpatient-orders.service";

const createOrderSchema = z.object({
  kind: z.enum(["MEDICATION", "PROCEDURE", "REGIMEN", "DIET", "NURSING"]),
  medicationId: z.string().optional(),
  procedureTypeId: z.string().optional(),
  dose: z.string().optional(),
  doseUnit: z.string().optional(),
  route: z.enum(["PO", "IV", "IM", "SC", "TOP", "INH", "SL", "PR", "OTHER"]).optional(),
  frequency: z.string().optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime().optional(),
  prn: z.boolean().optional(),
  orderedByPractitionerId: z.string().optional(),
});

const adminStatusSchema = z.object({
  status: z.enum(["GIVEN", "MISSED", "REFUSED", "HELD"]),
  note: z.string().optional(),
});

@Controller()
export class InpatientOrdersController {
  @UseGuards(ClinicApiGuard)
  @Get("api/inpatient/:id/orders")
  @HttpCode(200)
  async listOrders(@Req() httpReq: Request) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_INPATIENT_READ);
      if (denied) return clinicBody(denied);
      const admissionId = httpReq.params.id;
      return { items: await listOrdersForAdmission(admissionId) };
    });
  }

  @UseGuards(ClinicApiGuard)
  @Post("api/inpatient/:id/orders")
  @HttpCode(201)
  async createOrder(@Req() httpReq: Request) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      try {
        const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_INPATIENT);
        if (denied) return clinicBody(denied);
        const admissionId = httpReq.params.id;
        const body = createOrderSchema.parse(httpReq.body);
        const order = await createInpatientOrder({
          admissionId,
          kind: body.kind,
          medicationId: body.medicationId,
          procedureTypeId: body.procedureTypeId,
          dose: body.dose,
          doseUnit: body.doseUnit,
          route: body.route,
          frequency: body.frequency,
          startAt: new Date(body.startAt),
          endAt: body.endAt ? new Date(body.endAt) : null,
          prn: body.prn,
          orderedByPractitionerId: body.orderedByPractitionerId,
        });
        return { order };
      } catch (err) {
        if (err instanceof HttpException) throw err;
        return clinicBody(handleRouteError(err));
      }
    });
  }

  @UseGuards(ClinicApiGuard)
  @Patch("api/inpatient/orders/:orderId/stop")
  @HttpCode(200)
  async stopOrder(@Req() httpReq: Request) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      try {
        const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_INPATIENT);
        if (denied) return clinicBody(denied);
        const order = await stopInpatientOrder(httpReq.params.orderId);
        return { order };
      } catch (err) {
        if (err instanceof HttpException) throw err;
        return clinicBody(handleRouteError(err));
      }
    });
  }

  @UseGuards(ClinicApiGuard)
  @Patch("api/inpatient/order-administrations/:id")
  @HttpCode(200)
  async patchAdministration(@Req() httpReq: Request) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      try {
        const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_INPATIENT);
        if (denied) return clinicBody(denied);
        const body = adminStatusSchema.parse(httpReq.body);
        const row = await markAdministration(httpReq.params.id, body.status, {
          givenByUserId: session.userId,
          note: body.note,
        });
        return { administration: row };
      } catch (err) {
        if (err instanceof HttpException) throw err;
        return clinicBody(handleRouteError(err));
      }
    });
  }
}