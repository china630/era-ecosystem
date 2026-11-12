import { NextResponse } from "next/server";
import { z } from "zod";
import { enterRequestTenant } from "@/lib/request-organization";
import { listClinicSyncSnapshot } from "@/lib/services/clinic-sync-snapshot.service";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  organizationId: z.string().min(1),
  openReservationIds: z.array(z.string().min(1)).max(200).default([]),
});

function assertServiceToken(request: Request): boolean {
  const expected = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();
  if (!expected) return false;
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return token === expected;
}

/** In-house medical guests plus which of the clinic's open stays are already checked out. */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/internal/v1/reservations/clinic-sync", async (httpReq, httpRes) => {
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

  if (!assertServiceToken(request)) {
    return sendJson(httpRes, { error: "Unauthorized" }, 401);
  }
  const body = bodySchema.parse(httpReq.body);
  enterRequestTenant(body.organizationId);
  const snapshot = await listClinicSyncSnapshot(body);
  return sendJson(httpRes, snapshot);

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
