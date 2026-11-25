/** Lifted from era-hotel-pms/nest/generated/integration_gl-status.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { applyFiscalGlPostedStatus } from '@/lib/services/hotel-integration-status.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({
  fiscalDocumentId: z.string().uuid().optional(),
  invoiceNumber: z.string().optional(),
  glReference: z.string().min(1),
  glPostedAt: z.coerce.date().optional(),
});

/** Finance / 1C adapter callback — read-only GL posted status on fiscal document. */


@Controller()
export class IntegrationGlStatusController {
  @Post("api/integration/gl-status")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  
    const token = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();
    const auth = nestHeader(httpReq, 'authorization')?.replace(/^Bearer\s+/i, '').trim();
    if (token && auth !== token) {
      return sendJson(httpRes, { error: 'Unauthorized' }, 401);
    }

    const body = bodySchema.parse(httpReq.body);
    const updated = await applyFiscalGlPostedStatus(body);

    if (!updated) {
      return sendJson(httpRes, { error: 'Fiscal document not found' }, 404);
    }

    return sendJson(httpRes, {
      id: updated.id,
      glPostedAt: updated.glPostedAt?.toISOString(),
      glReference: updated.glReference,
    });
  
        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
