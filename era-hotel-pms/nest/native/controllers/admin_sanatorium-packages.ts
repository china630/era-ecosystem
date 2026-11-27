/** Admin CRUD + sync for HotelSellablePackage (gate hotel_medical_sanatorium). */
import { Controller, Get, Patch, Post, HttpCode, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import {
  listSellablePackages,
  syncSellablePackagesFromClinic,
  updateSellablePackage,
  countActiveMedicalPackages,
} from '@/lib/services/hotel-sellable-package.service';
import { requireSanatoriumModule } from '@/lib/sanatorium-module';
import { requestOrganizationId } from '@/lib/request-organization';
import {
  enterHotelStaff,
  hotelNestSession,
  runWithHotelTenant,
  sendJson,
  sendRouteError,
} from '../../bridge';

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  family: z.enum(['MEDICAL', 'INFOTUR']).optional(),
  active: z.boolean().optional(),
  ratePlanId: z.string().uuid().nullable().optional(),
  minNights: z.number().int().positive().nullable().optional(),
  maxNights: z.number().int().positive().nullable().optional(),
  durationDays: z.number().int().positive().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

@Controller()
export class AdminSanatoriumPackagesController {
  @Get('api/admin/sanatorium-packages')
  @HttpCode(200)
  async list(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      await runWithHotelTenant(session, async () => {
        assertPermission(session, PERMISSIONS.PRICING_ADMIN);
        await requireSanatoriumModule(requestOrganizationId());
        const items = await listSellablePackages();
        const activeMedical = await countActiveMedicalPackages();
        return sendJson(httpRes, serialize({ items, activeMedical }));
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }

  @Post('api/admin/sanatorium-packages/sync')
  @HttpCode(200)
  async sync(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      await runWithHotelTenant(session, async () => {
        assertPermission(session, PERMISSIONS.PRICING_ADMIN);
        await requireSanatoriumModule(requestOrganizationId());
        const result = await syncSellablePackagesFromClinic();
        return sendJson(httpRes, serialize(result));
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }

  @Patch('api/admin/sanatorium-packages/:id')
  @HttpCode(200)
  async patch(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      await runWithHotelTenant(session, async () => {
        assertPermission(session, PERMISSIONS.PRICING_ADMIN);
        await requireSanatoriumModule(requestOrganizationId());
        const id = String(httpReq.params.id ?? '');
        const body = patchSchema.parse(httpReq.body);
        const row = await updateSellablePackage(id, body);
        return sendJson(httpRes, serialize(row));
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
