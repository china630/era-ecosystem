/** Lifted from era-hotel-pms/nest/generated/medical_orders.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { addLabResult, createOrder, postProcedureToFolio } from '@/lib/services/medical.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const orderSchema = z.object({
  reservationId: z.string().uuid(),
  orderType: z.string().min(1),
});

const labSchema = z.object({
  orderId: z.string().uuid(),
  testName: z.string(),
  resultValue: z.string(),
  flag: z.enum(['NORMAL', 'HIGH', 'LOW']).optional(),
});

const procSchema = z.object({
  reservationId: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  amount: z.number().positive(),
});


@Controller()
export class MedicalOrdersController {
  @Post("api/medical/orders")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.MEDICAL_MANAGE);
    const body = httpReq.body;
    if (body.orderId && body.testName) {
      return sendJson(httpRes, serialize(await addLabResult(body.orderId, labSchema.parse(body))), 201);
    }
    if (body.code && body.name && body.amount) {
      return sendJson(httpRes, serialize(await postProcedureToFolio(body.reservationId, procSchema.parse(body))), 201);
    }
    const data = orderSchema.parse(body);
    return sendJson(httpRes, serialize(await createOrder(data.reservationId, data.orderType)), 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
