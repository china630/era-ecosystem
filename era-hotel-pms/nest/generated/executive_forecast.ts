import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertAnyPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getOccupancyForecast } from '@/lib/services/forecast.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const querySchema = z.object({
  days: z.coerce
    .number()
    .int()
    .optional()
    .default(14)
    .refine((d) => [7, 14, 30, 90].includes(d), {
      message: 'days must be 7, 14, 30, or 90',
    }),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/executive/forecast", async (httpReq, httpRes) => {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    assertAnyPermission(session, [
      PERMISSIONS.REPORTS_READ,
      PERMISSIONS.RESERVATIONS_READ,
    ]);
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const { days } = querySchema.parse(params);
    return sendJson(httpRes, serialize(await getOccupancyForecast(days)));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
