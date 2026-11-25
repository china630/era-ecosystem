/** Lifted from era-hotel-pms/nest/generated/master_rate-plans__id.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { localizedNameFields } from '@/lib/catalog-label';
import { serialize } from '@/lib/serialize';
import { deleteRatePlan, updateRatePlan } from '@/lib/services/master-data.service';
import { assertMasterDataWrite } from '@/lib/auth/master-data-guard';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.object({
  name: z.string().min(1).optional(),
  ...localizedNameFields,
  pricePerNight: z.number().positive().optional(),
  medicalFlag: z.boolean().optional(),
  roomTypeId: z.string().uuid().nullable().optional(),
  mealPlanId: z.string().uuid().nullable().optional(),
  active: z.boolean().optional(),
  baseOccupancy: z.number().int().min(1).max(10).optional(),
  extraAdultAmount: z.number().min(0).nullable().optional(),
  thirdAdultAmount: z.number().min(0).nullable().optional(),
  extraBedAmount: z.number().min(0).nullable().optional(),
});


@Controller()
export class MasterRatePlansIdController {
  @Patch("api/master/rate-plans/:id")
  @HttpCode(200)
  async patch_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertMasterDataWrite(session, PERMISSIONS.RATES_ADMIN);
    const { id } = httpReq.params;
    const body = schema.parse(httpReq.body);
    return sendJson(httpRes, serialize(await updateRatePlan(id, body)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Delete("api/master/rate-plans/:id")
  @HttpCode(200)
  async delete_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  try {
    assertMasterDataWrite(session, PERMISSIONS.RATES_ADMIN);
    const { id } = httpReq.params;
    await deleteRatePlan(id);
    return sendJson(httpRes, { ok: true });
  } catch (err) {
    const inUse = err as {
      code?: string;
      reservations?: number;
      contracts?: number;
      slices?: number;
      derived?: number;
      message?: string;
    };
    if (inUse?.code === 'RATE_PLAN_IN_USE') {
      return sendJson(httpRes, 
        {
          error: inUse.message,
          code: 'RATE_PLAN_IN_USE',
          reservations: inUse.reservations ?? 0,
          contracts: inUse.contracts ?? 0,
          slices: inUse.slices ?? 0,
          derived: inUse.derived ?? 0,
        }, 409);
    }
    return sendRouteError(httpRes, err);
  }

      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
