/** Lifted from era-hotel-pms/nest/generated/internal_v1_stays_by-external-ref.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { enterRequestTenant } from "@/lib/request-organization";
import { findStayByExternalRef } from "@/lib/services/reservation.service";
import { pickStayGlobalPersonId } from "@/lib/services/stay-person-lookup.service";
import { assertEnvServiceToken } from "@era/satellite-kit";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const querySchema = z.object({
  externalRef: z.string().min(1),
  organizationId: z.string().min(1),
  folioPerson: z.coerce.number().int().positive().optional(),
});

function unauthorized(message: string) {
  return Response.json({ error: message }, { status: 401 });
}

/**
 * Clinic #21 cutover: resolve hotel stay by Elektraweb RESID / RESNAMEID → MDM person.
 * Bearer SATELLITE_EVENT_SERVICE_TOKEN.
 */


@Controller()
export class InternalV1StaysByExternalRefController {
  @Get("api/internal/v1/stays/by-external-ref")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  
    const gate = assertEnvServiceToken({
      expectedEnvKeys: ["SATELLITE_EVENT_SERVICE_TOKEN"],
      authorization: nestHeader(httpReq, "authorization"),
      xServiceToken: nestHeader(httpReq, "x-service-token"),
    });
    if (!gate.ok) return unauthorized(gate.error);

    const url = requestUrl;
    const parsed = querySchema.safeParse({
      externalRef: url.searchParams.get("externalRef") ?? "",
      organizationId: url.searchParams.get("organizationId") ?? "",
      folioPerson: url.searchParams.get("folioPerson") || undefined,
    });
    if (!parsed.success) {
      return sendJson(httpRes, { error: "externalRef and organizationId required" }, 400);
    }

    const { externalRef, organizationId, folioPerson } = parsed.data;
    enterRequestTenant(organizationId);

    const stay = await findStayByExternalRef(organizationId, externalRef);
    if (!stay) {
      return sendJson(httpRes, { found: false, globalPersonId: null }, 200);
    }

    const globalPersonId = pickStayGlobalPersonId(
      {
        guest: stay.guest,
        reservationGuests: stay.paxGuests,
      },
      folioPerson ?? null,
    );
    return sendJson(httpRes, {
      found: true,
      reservationId: stay.id,
      globalPersonId,
      checkInDate: stay.checkInDate.toISOString(),
      checkOutDate: stay.checkOutDate.toISOString(),
    });
  
        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
