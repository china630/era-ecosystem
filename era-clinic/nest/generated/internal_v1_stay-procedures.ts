import { NextRequest } from "next/server";
import { enterRequestTenant } from "@/lib/request-organization";
import { clearStayProceduresAtCheckout, listStayProceduresForCheckout } from "@/domain/sanatorium/stay-checkout-snapshot.service";
import { z } from "zod";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

function assertServiceToken(req: NextRequest): boolean {
  const expected = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();
  if (!expected) return false;
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return token === expected;
}

/** Hotel checkout reads paid procedures and package attendance for one reservation. */


const clearSchema = z.object({
  organizationId: z.string().min(1),
  reservationId: z.string().min(1),
});

/** Hotel check-out: cancel future extras / package seats; apply no-show policy. */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/internal/v1/stay-procedures", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const req = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    if (!assertServiceToken(req)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const url = new URL(req.url);
    const organizationId = url.searchParams.get("organizationId")?.trim() ?? "";
    const reservationId = url.searchParams.get("reservationId")?.trim() ?? "";
    if (!organizationId || !reservationId) {
      return sendJson(httpRes, { error: "organizationId and reservationId required" }, 400);
    }
    enterRequestTenant(organizationId);
    return sendJson(httpRes, await listStayProceduresForCheckout(reservationId));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/internal/v1/stay-procedures", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const req = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    if (!assertServiceToken(req)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const body = clearSchema.parse(httpReq.body);
    enterRequestTenant(body.organizationId);
    const { closeOpenEpisodesForReservation } = await import("@/lib/lifecycle-consumer");
    const closed = await closeOpenEpisodesForReservation(body.reservationId);
    const cleared = await clearStayProceduresAtCheckout(body.reservationId);
    const cancelledOrderIds = [
      ...new Set([...closed.cancelledOrderIds, ...cleared.cancelledOrderIds]),
    ];
    return sendJson(httpRes, { ...cleared, cancelledOrderIds });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
