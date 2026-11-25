/** Lifted from era-hotel-pms/nest/generated/admin_child-matrix__id.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { deleteChildPricingRow, updateChildPricingRow } from '@/lib/services/wave-b-master.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.object({
  ageFrom: z.number().int().min(0).optional(),
  ageTo: z.number().int().min(0).optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  amountOverride: z.number().min(0).nullable().optional(),
  freeCount: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});


@Controller()
export class AdminChildMatrixIdController {
  @Patch("api/admin/child-matrix/:id")
  @HttpCode(200)
  async patch_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.CHILD_MATRIX_ADMIN);
    const { id } = httpReq.params;
    const body = schema.parse(httpReq.body);
    return sendJson(httpRes, serialize(await updateChildPricingRow(id, body)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Delete("api/admin/child-matrix/:id")
  @HttpCode(200)
  async delete_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.CHILD_MATRIX_ADMIN);
    const { id } = httpReq.params;
    await deleteChildPricingRow(id);
    return sendJson(httpRes, { ok: true });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
