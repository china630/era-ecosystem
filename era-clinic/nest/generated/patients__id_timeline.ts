import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { getPatientTimeline, type TimelineEventType } from "@/domain/patient/patient-timeline.service";
import { findPatientRefId } from "@/domain/patient/patient.service";
import { readUiLocale } from "@/lib/request-locale";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const querySchema = z.object({
  types: z.string().optional(),
  limitDays: z.coerce.number().int().min(1).max(365).optional(),
});

const TYPE_SET = new Set<TimelineEventType>([
  "appointment",
  "visit",
  "lab_order",
  "procedure",
  "episode",
]);

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/patients/:id/timeline", async (httpReq, httpRes) => {
    if (!(await enterClinicStaff(httpReq, httpRes))) return;
    try {
      const session = await clinicNestSession(httpReq);
      const web = await runWithClinicTenant(session, async () => {
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

  
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PATIENTS_READ);
    if (denied) return denied;

        const { id } = httpReq.params;
    if (!(await findPatientRefId(id))) return sendJson(httpRes, { error: "Not found" }, 404);

    const url = new URL(req.url);
    const query = querySchema.parse({
      types: url.searchParams.get("types") ?? undefined,
      limitDays: url.searchParams.get("limitDays") ?? undefined,
    });
    const types = query.types
      ? (query.types
          .split(",")
          .map((t) => t.trim())
          .filter((t): t is TimelineEventType => TYPE_SET.has(t as TimelineEventType)) as TimelineEventType[])
      : undefined;

    return sendJson(httpRes, 
      await getPatientTimeline(id, {
        types: types?.length ? types : undefined,
        limitDays: query.limitDays,
        locale: await readUiLocale(req),
      }),
    );
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
