/** Lifted from era-hotel-pms/nest/generated/folios_payments__id_transfer.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { transferFolioPayment } from '@/lib/services/folio-transfer.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({
  note: z.string().trim().min(1).max(500),
  targetFolioType: z.enum(['GUEST', 'AGENCY', 'COMPANY']).optional(),
  targetReservationId: z.string().uuid().optional(),
  targetReservationGuestId: z.string().uuid().optional(),
});


@Controller()
export class FoliosPaymentsIdTransferController {
  @Post("api/folios/payments/:id/transfer")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
    const { id } = httpReq.params;
    const body = bodySchema.parse(httpReq.body);
    return sendJson(httpRes, 
      serialize(
        await transferFolioPayment({
          paymentId: id,
          note: body.note,
          targetFolioType: body.targetFolioType,
          targetReservationId: body.targetReservationId,
          targetReservationGuestId: body.targetReservationGuestId,
          actorUserId: session?.sub,
          request: { headers: { get: (name: string) => nestHeader(httpReq, name) } },
        }),
      ),
    );
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
