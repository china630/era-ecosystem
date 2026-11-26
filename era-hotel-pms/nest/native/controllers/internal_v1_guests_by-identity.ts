/** Lifted from era-hotel-pms/nest/generated/internal_v1_guests_by-identity.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { enterRequestTenant } from "@/lib/request-organization";
import { lookupGuestGlobalPersonByIdentity } from "@/lib/services/guest-identity-lookup.service";
import { assertEnvServiceToken } from "@era/satellite-kit";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const querySchema = z.object({
  organizationId: z.string().min(1),
  fullName: z.string().min(1),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  phone: z.string().optional(),
});

function unauthorized(message: string) {
  return Response.json({ error: message }, { status: 401 });
}

/**
 * Clinic #21 cutover: Guest by given+surname (+patronymic) + birthDate + optional phone.
 * Bearer SATELLITE_EVENT_SERVICE_TOKEN.
 */


@Controller()
export class InternalV1GuestsByIdentityController {
  @Get("api/internal/v1/guests/by-identity")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
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
      organizationId: url.searchParams.get("organizationId") ?? "",
      fullName: url.searchParams.get("fullName") ?? "",
      birthDate: url.searchParams.get("birthDate") ?? "",
      phone: url.searchParams.get("phone") || undefined,
    });
    if (!parsed.success) {
      return sendJson(httpRes, 
        { error: "organizationId, fullName, and birthDate (YYYY-MM-DD) required" }, 400);
    }

    const { organizationId, fullName, birthDate, phone } = parsed.data;
    enterRequestTenant(organizationId);

    const globalPersonId = await lookupGuestGlobalPersonByIdentity({
      organizationId,
      fullName,
      birthDate,
      phone,
    });
    return sendJson(httpRes, {
      found: Boolean(globalPersonId),
      globalPersonId,
    });
  
        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
