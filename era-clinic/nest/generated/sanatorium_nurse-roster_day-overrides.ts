import { z } from "zod";
import { getSatelliteSession, requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { recordClinicAudit } from "@/lib/satellite-audit";
import { readUiLocale } from "@/lib/request-locale";
import { deleteDayOverride, listDayOverrides, upsertDayOverride } from "@/domain/staff/staff-duty-roster.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const staffKindSchema = z.enum(["NURSE", "LAB"]).default("NURSE");

const upsertSchema = z.object({
  yearMonth: z.string(),
  staffKind: staffKindSchema.optional(),
  dutyDate: z.string().min(10),
  procedureTypeId: z.string().min(1),
  practitionerId: z.string().min(1),
  note: z.string().max(200).nullable().optional(),
});

async function rosterForbidden(
  session: Awaited<ReturnType<typeof getSatelliteSession>>,
) {
  return requireClinicPermission(session, CLINIC_PERMISSION.API_SANATORIUM_NURSE_ROSTER);
}

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/sanatorium/nurse-roster/day-overrides", async (httpReq, httpRes) => {
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

  
    const denied = await rosterForbidden(session);
    if (denied) return denied;
    const url = new URL(req.url);
    const yearMonth = url.searchParams.get("yearMonth") ?? "";
    const staffKindRaw = url.searchParams.get("staffKind") ?? "NURSE";
    const dutyDate = url.searchParams.get("dutyDate") ?? undefined;
    const locale = await readUiLocale(req);
    return sendJson(httpRes, 
      await listDayOverrides({
        yearMonth,
        staffKind: staffKindRaw === "LAB" ? "LAB" : "NURSE",
        dutyDate,
        locale,
      }),
    );
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.put("/api/sanatorium/nurse-roster/day-overrides", async (httpReq, httpRes) => {
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

  
    const denied = await rosterForbidden(session);
    if (denied) return denied;
    const body = upsertSchema.parse(httpReq.body);
    const row = await upsertDayOverride({
      ...body,
      createdByUserId: session!.sub,
    });
    await recordClinicAudit(
      { userId: session!.sub, request: req },
      "staffDutyDayOverride",
      row.id,
      "UPSERT",
      {
        yearMonth: body.yearMonth,
        dutyDate: body.dutyDate,
        procedureTypeId: body.procedureTypeId,
        practitionerId: body.practitionerId,
      },
    );
    return sendJson(httpRes, row);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.delete("/api/sanatorium/nurse-roster/day-overrides", async (httpReq, httpRes) => {
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

  
    const denied = await rosterForbidden(session);
    if (denied) return denied;
    const id = new URL(req.url).searchParams.get("id");
    if (!id) {
      return sendJson(httpRes, { error: "id required" }, 400);
    }
    await deleteDayOverride(id);
    await recordClinicAudit(
      { userId: session!.sub, request: req },
      "staffDutyDayOverride",
      id,
      "DELETE",
    );
    return sendJson(httpRes, { deleted: true });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
