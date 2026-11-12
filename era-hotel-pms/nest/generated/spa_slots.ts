import { z } from "zod";
import { requireHotelModule } from "@/lib/hotel-module-gate";
import { createBookingSlot } from "@/integration/control-plane-platform.client";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  resourceKey: z.string().min(1).max(64).default("spa-cabin-1"),
  resourceName: z.string().max(256).optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  capacity: z.number().int().min(1).max(32).optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/spa/slots", async (httpReq, httpRes) => {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const req = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    await requireHotelModule("hotel_spa_scheduling", session.organizationId);
    const body = bodySchema.parse(httpReq.body);

    const slot = await createBookingSlot(
      {
        resourceKey: body.resourceKey,
        resourceName: body.resourceName ?? `SPA ${body.resourceKey}`,
        startsAt: body.startsAt,
        endsAt: body.endsAt,
        capacity: body.capacity ?? 1,
      },
      { organizationId: session.organizationId },
    );

    return sendJson(httpRes, slot);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
