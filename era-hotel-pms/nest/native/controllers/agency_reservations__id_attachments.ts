/** Lifted from era-hotel-pms/nest/generated/agency_reservations__id_attachments.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { serialize } from '@/lib/serialize';
import { requireAgencyPortalSession } from '@/lib/auth/agency-session';
import { findAgencyOwnedReservation } from '@/lib/services/agency-portal.service';
import { uploadReservationAttachmentFile } from '@/lib/services/reservation-attachments.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

/**
 * Agency uploads optional passport scan for own reservation.
 * multipart: file + optional kind=PASSPORT_SCAN
 */


@Controller()
export class AgencyReservationsIdAttachmentsController {
  @Post("api/agency/reservations/:id/attachments")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
    if (rejectMissingAgency(httpReq, httpRes)) return;
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  
    const session = await requireAgencyPortalSession();
    const { id } = httpReq.params;
    const reservation = await findAgencyOwnedReservation(session.agencyId, id);
    if (!reservation) {
      return sendJson(httpRes, { error: 'Reservation not found' }, 404);
    }

    const form = await readNestForm(httpReq);
    const file = form.get('file');
    if (!(file instanceof File)) {
      return sendJson(httpRes, { error: 'file required' }, 400);
    }
    const kindRaw = String(form.get('kind') ?? 'PASSPORT_SCAN');
    const kind = kindRaw === 'OTHER' ? 'OTHER' : 'PASSPORT_SCAN';
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > 8 * 1024 * 1024) {
      return sendJson(httpRes, { error: 'File too large (max 8MB)' }, 400);
    }
    const row = await uploadReservationAttachmentFile({
      reservationId: id,
      fileName: file.name || 'passport.bin',
      mimeType: file.type || undefined,
      buffer,
      kind,
    });
    return sendJson(httpRes, serialize(row), 201);
  
        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
