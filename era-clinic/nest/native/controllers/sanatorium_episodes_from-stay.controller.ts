import { Controller, HttpCode, Post, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  nestHeader,
  withClinicHttp,
  clinicBody,
} from "../../bridge";
import { z } from 'zod';
import { enterRequestTenant } from '@/lib/request-organization';
import { openEpisodeFromStay } from '@/lib/services/sanatorium.service';


const bodySchema = z.object({
  reservationId: z.string(),
  hotelStayId: z.string().nullable().optional(),
  guestName: z.string().min(1),
  passportNumber: z.string().min(1),
  phone: z.string().optional(),
  organizationId: z.string().min(1),
  globalPersonId: z.string().nullable().optional(),
  /** Medical package / program template code from hotel rate stamp. */
  programCode: z.string().min(1).nullable().optional(),
  roomNumber: z.string().nullable().optional(),
  paxKey: z.string().nullable().optional(),
  sex: z.string().nullable().optional(),
  birthDate: z.string().nullable().optional(),
  nationality: z.string().nullable().optional(),
});

/** SEC-CLI-01: fail closed in production when CLINIC_BRIDGE_SECRET unset */
function assertBridgeSecret(req: Request) {
  const expected = process.env.CLINIC_BRIDGE_SECRET?.trim();
  if (!expected) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Invalid bridge secret');
    }
    return;
  }
  const got = nestHeader(req, 'x-clinic-bridge-secret');
  if (got !== expected) {
    throw new Error('Invalid bridge secret');
  }
}

@Controller()
export class SanatoriumEpisodesFromStayController {

  @Post("api/sanatorium/episodes/from-stay")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      try {
    assertBridgeSecret(httpReq);
    const body = bodySchema.parse(httpReq.body);
    enterRequestTenant(body.organizationId);
    const episode = await openEpisodeFromStay(body);
    return episode;
  } catch (err) {
    if (err instanceof HttpException) throw err;
    if (err instanceof Error && err.message === 'Invalid bridge secret') {
      throw new HttpException({ error: 'Unauthorized' }, 401);
    }
    return clinicBody(handleRouteError(err));
  }

        });
  }
}
