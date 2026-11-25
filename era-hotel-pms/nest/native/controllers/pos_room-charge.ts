/** Lifted from era-hotel-pms/nest/generated/pos_room-charge.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { postRoomCharge } from '@/lib/services/pos.service';
import { assertPosBridgeOrPermission } from '@/lib/pos-bridge-auth';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterSatelliteTenant, satelliteRuntimeConfig } from '@era/satellite-kit';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.object({
  organizationId: z.string().uuid().optional(),
  reservationId: z.string().uuid().optional(),
  roomNumber: z.string().optional(),
  revenueCode: z.string().min(1),
  amount: z.number().finite(),
  qty: z.number().int().refine((qty) => qty !== 0).optional(),
  description: z.string().min(1),
  outletCode: z.string().optional(),
  productSku: z.string().min(1).optional(),
  warehouseCode: z.string().min(1).optional(),
  externalTicketId: z.string().min(1).optional(),
  ticketNumber: z.string().optional(),
  sourceOrganizationId: z.string().min(1).optional(),
  posShiftId: z.string().uuid().optional(),
  waiterCode: z.string().optional(),
});


@Controller()
export class PosRoomChargeController {
  @Post("api/pos/room-charge")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  
    await assertPosBridgeOrPermission({ headers: { get: (name: string) => nestHeader(httpReq, name) }, url: new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").toString() }, PERMISSIONS.FOLIO_CHARGE);
    const body = schema.parse(httpReq.body);
    if (!body.reservationId && !body.roomNumber) {
      throw new Error('reservationId or roomNumber required');
    }

    const orgFromHeader = nestHeader(httpReq, 'x-era-organization-id')?.trim();
    const organizationId = body.organizationId?.trim() || orgFromHeader || '';
    if (
      satelliteRuntimeConfig().deploymentTopology === 'SHARED' &&
      !organizationId
    ) {
      return sendJson(httpRes, 
        { error: 'organizationId required on SHARED pool' }, 400);
    }
    if (organizationId) {
      enterSatelliteTenant({ organizationId });
    }

    const headerKey = nestHeader(httpReq, 'idempotency-key')?.trim();
    const idempotencyKey = headerKey || body.externalTicketId;

    const result = await postRoomCharge({
      reservationId: body.reservationId,
      roomNumber: body.roomNumber,
      revenueCode: body.revenueCode,
      amount: body.amount,
      qty: body.qty,
      description: body.description,
      outletCode: body.outletCode,
      productSku: body.productSku,
      warehouseCode: body.warehouseCode,
      sourceOrganizationId: body.sourceOrganizationId,
      idempotencyKey,
    });

    const charge = result.charge;
    return sendJson(httpRes, 
      serialize({
        ...charge,
        reservationId: result.reservationId,
        idempotent: result.idempotent,
      }),
      result.idempotent ? 200 : 201,
    );
  
        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
