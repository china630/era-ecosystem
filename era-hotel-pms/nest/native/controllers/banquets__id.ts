/** Lifted from era-hotel-pms/nest/generated/banquets__id.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { confirmBanquetEvent, getBanquetEvent } from '@/lib/services/banquet.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const patchSchema = z.object({
  action: z.enum(['confirm']),
  preferredFolioType: z.enum(['GUEST', 'COMPANY', 'AGENCY']).optional(),
});


@Controller()
export class BanquetsIdController {
  @Get("api/banquets/:id")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.BANQUETS_READ);
    const { id } = httpReq.params;
    return sendJson(httpRes, serialize(await getBanquetEvent(id)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Patch("api/banquets/:id")
  @HttpCode(200)
  async patch_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.BANQUETS_WRITE);
    const { id } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);

    if (body.action === 'confirm') {
      return sendJson(httpRes, 
        serialize(
          await confirmBanquetEvent(id, {
            preferredFolioType: body.preferredFolioType,
          }),
        ),
      );
    }

    return sendJson(httpRes, serialize(await getBanquetEvent(id)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
