import { z } from "zod";
import { enterRequestTenant } from "@/lib/request-organization";
import { findStayByExternalRef } from "@/lib/services/reservation.service";
import { pickStayGlobalPersonId } from "@/lib/services/stay-person-lookup.service";
import { assertEnvServiceToken } from "@era/satellite-kit";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

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

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/internal/v1/stays/by-external-ref", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    const gate = assertEnvServiceToken({
      expectedEnvKeys: ["SATELLITE_EVENT_SERVICE_TOKEN"],
      authorization: request.headers.get("authorization"),
      xServiceToken: request.headers.get("x-service-token"),
    });
    if (!gate.ok) return unauthorized(gate.error);

    const url = new URL(request.url);
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
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
