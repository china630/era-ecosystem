/** Lifted from era-hotel-pms/nest/generated/internal_v1_folio-charges_received.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { parseFolioChargeRef } from '@era/satellite-kit/integration/folio-charge-ref';
import { markFolioChargeServiceReceived } from '@/lib/services/folio.service';
import { enterRequestTenant } from '@/lib/request-organization';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

/** Canonical key plus a stored `pay-` row from before the shared contract. */
function chargeRefCandidates(externalRef: string): string[] {
  const raw = externalRef.trim();
  const parsed = parseFolioChargeRef(raw);
  const out = new Set<string>([raw]);
  if (parsed?.ref) out.add(parsed.ref);
  if (parsed?.source === 'clinic') out.add(`pay-${parsed.ref}`);
  return [...out];
}

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  externalRef: z.string().min(1),
});

function assertServiceToken(request: Request): boolean {
  const expected = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();
  if (!expected) return false;
  const auth = request.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return token === expected;
}

/** Clinic check-in marks the existing folio line received. Amount stays the same. */


@Controller()
export class InternalV1FolioChargesReceivedController {
  @Post("api/internal/v1/folio-charges/received")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  if (!assertServiceToken({ headers: { get: (name: string) => nestHeader(httpReq, name) }, url: new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").toString() })) {
    return sendJson(httpRes, { error: 'Unauthorized' }, 401);
  }
  const body = bodySchema.parse(httpReq.body);
  enterRequestTenant(body.organizationId);
  const charge = await markFolioChargeServiceReceived(chargeRefCandidates(body.externalRef));
  if (!charge) return sendJson(httpRes, { error: 'Charge not found' }, 404);
  return sendJson(httpRes, { ok: true, chargeId: charge.id });

        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
