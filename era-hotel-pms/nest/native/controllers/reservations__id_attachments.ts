/** Lifted from era-hotel-pms/nest/generated/reservations__id_attachments.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { createReservationAttachment, listReservationAttachments } from '@/lib/services/reservation-attachments.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const postSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().optional(),
  fileSize: z.number().int().optional(),
  kind: z.enum(['PASSPORT_SCAN', 'OTHER']).optional(),
  storageKey: z.string().optional(),
});


@Controller()
export class ReservationsIdAttachmentsController {
  @Get("api/reservations/:id/attachments")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const { id } = httpReq.params;
    return sendJson(httpRes, serialize(await listReservationAttachments(id)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/reservations/:id/attachments")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const { id } = httpReq.params;
    const contentType = nestHeader(httpReq, 'content-type') ?? '';
    if (contentType.includes('multipart/form-data')) {
      const { uploadReservationAttachmentFile } = await import(
        '@/lib/services/reservation-attachments.service'
      );
      const form = await readNestForm(httpReq);
      const file = form.get('file');
      if (!(file instanceof File)) {
        return sendJson(httpRes, { error: 'file required' }, 400);
      }
      const kindRaw = String(form.get('kind') ?? 'OTHER');
      const kind = kindRaw === 'PASSPORT_SCAN' ? 'PASSPORT_SCAN' : 'OTHER';
      const buffer = Buffer.from(await file.arrayBuffer());
      const row = await uploadReservationAttachmentFile({
        reservationId: id,
        fileName: file.name || 'attachment.bin',
        mimeType: file.type || undefined,
        buffer,
        kind,
      });
      return sendJson(httpRes, serialize(row), 201);
    }
    const body = postSchema.parse(httpReq.body);
    return sendJson(httpRes, serialize(await createReservationAttachment(id, body)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
