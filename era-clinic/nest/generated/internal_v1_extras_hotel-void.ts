import { z } from "zod";
import { NextRequest } from "next/server";
import { enterRequestTenant } from "@/lib/request-organization";
import { applyHotelVoidToExtra } from "@/domain/sanatorium/extras-assign.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

/**
 * CLI-57 W4 — hotel folio void inbound → cancel clinic extra + invalidate ticket.
 * Auth: Bearer SATELLITE_EVENT_SERVICE_TOKEN (same class as lifecycle).
 */
const schema = z.object({
  organizationId: z.string().min(1),
  externalTicketId: z.string().optional(),
  orderId: z.string().optional(),
});

function assertServiceToken(req: NextRequest): boolean {
  const expected = process.env.SATELLITE_EVENT_SERVICE_TOKEN;
  if (!expected) return false;
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return token === expected;
}

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/internal/v1/extras/hotel-void", async (httpReq, httpRes) => {
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
    const body = schema.parse(httpReq.body);
    if (!body.externalTicketId && !body.orderId) {
      return sendJson(httpRes, { error: "externalTicketId or orderId required" }, 400);
    }
    enterRequestTenant(body.organizationId);
    const result = await applyHotelVoidToExtra({
      externalTicketId: body.externalTicketId,
      orderId: body.orderId,
    });
    return sendJson(httpRes, result);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
