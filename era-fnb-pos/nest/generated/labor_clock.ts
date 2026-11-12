import { z } from "zod";
import { createPinClockEvent, findStaffRosterByStaffCode, pinMatches } from "@/lib/labor-pin";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  staffCode: z.string().min(1),
  pin: z.string().min(4).max(8),
  eventType: z.enum(["CLOCK_IN", "CLOCK_OUT"]).default("CLOCK_IN"),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/labor/clock", async (httpReq, httpRes) => {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
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

  
    if (!(session)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const body = bodySchema.parse(httpReq.body);
    const staff = await findStaffRosterByStaffCode(body.staffCode);
    if (!staff || !staff.active) return sendJson(httpRes, { error: "Staff not found" }, 404);
    if (!pinMatches(staff.pinHash, body.pin)) return sendJson(httpRes, { error: "Invalid PIN" }, 401);
    const event = await createPinClockEvent({
      staffCode: body.staffCode,
      eventType: body.eventType,
    });
    return sendJson(httpRes, event, 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
