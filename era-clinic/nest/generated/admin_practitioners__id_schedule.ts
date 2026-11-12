import { z } from "zod";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { getPractitionerById, auditMasterChange } from "@/lib/services/clinic-master-data.service";
import { getPractitionerSchedule, replacePractitionerSchedule } from "@/domain/appointment/practitioner-schedule-admin.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const ruleSchema = z
  .object({
    pattern: z.enum(["WEEKLY", "WEEK_PARITY", "MONTH_DAY_PARITY", "CYCLE"]),
    weekdays: z.array(z.number().int().min(0).max(6)).optional(),
    parity: z.enum(["EVEN", "ODD"]).nullable().optional(),
    cycleAnchor: z.string().optional().nullable(),
    cycleLengthDays: z.number().int().min(1).max(60).nullable().optional(),
    cycleOffsets: z.array(z.number().int().min(0)).optional(),
    startMinute: z.number().int().min(0).max(1440),
    endMinute: z.number().int().min(0).max(1440),
    effectiveFrom: z.string().nullable().optional(),
    effectiveTo: z.string().nullable().optional(),
    sortOrder: z.number().int().optional(),
  })
  .refine((r) => r.endMinute > r.startMinute, {
    message: "endMinute must be greater than startMinute",
  })
  .refine((r) => r.pattern !== "CYCLE" || (!!r.cycleAnchor && !!r.cycleLengthDays), {
    message: "CYCLE requires cycleAnchor and cycleLengthDays",
  });

const exceptionSchema = z
  .object({
    date: z.string().min(10),
    kind: z.enum(["DAY_OFF", "EXTRA_SHIFT", "CUSTOM_HOURS"]),
    startMinute: z.number().int().min(0).max(1440).nullable().optional(),
    endMinute: z.number().int().min(0).max(1440).nullable().optional(),
    note: z.string().max(200).nullable().optional(),
  })
  .refine(
    (e) =>
      e.kind === "DAY_OFF" ||
      (typeof e.startMinute === "number" &&
        typeof e.endMinute === "number" &&
        e.endMinute > e.startMinute),
    { message: "EXTRA_SHIFT / CUSTOM_HOURS require a valid start/end window" },
  );

const putSchema = z.object({
  rules: z.array(ruleSchema),
  exceptions: z.array(exceptionSchema),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/practitioners/:id/schedule", async (httpReq, httpRes) => {
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

  
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const { id } = httpReq.params;
    const existing = await getPractitionerById(id);
    if (!existing) return sendJson(httpRes, { error: "Not found" }, 404);
    return sendJson(httpRes, await getPractitionerSchedule(id));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.put("/api/admin/practitioners/:id/schedule", async (httpReq, httpRes) => {
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

  
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const { id } = httpReq.params;
    const existing = await getPractitionerById(id);
    if (!existing) return sendJson(httpRes, { error: "Not found" }, 404);
    const body = putSchema.parse(httpReq.body);
    const result = await replacePractitionerSchedule(id, body);
    await auditMasterChange(
      { userId: guard.session.sub, request: req },
      "practitionerSchedule",
      id,
      "REPLACE",
      { rules: body.rules.length, exceptions: body.exceptions.length },
    );
    return sendJson(httpRes, result);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
