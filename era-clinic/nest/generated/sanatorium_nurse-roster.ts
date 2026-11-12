import { z } from "zod";
import { getSatelliteSession, requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { recordClinicAudit } from "@/lib/satellite-audit";
import { readUiLocale } from "@/lib/request-locale";
import { approveDutyRoster, copyDutyRosterFromPrevious, getOrCreateDutyRoster, saveDutyRoster } from "@/domain/staff/staff-duty-roster.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const staffKindSchema = z.enum(["NURSE", "LAB"]).default("NURSE");

const saveSchema = z.object({
  yearMonth: z.string(),
  staffKind: staffKindSchema.optional(),
  note: z.string().max(500).nullable().optional(),
  lines: z.array(
    z.object({
      procedureTypeId: z.string().min(1),
      practitionerId: z.string().nullable().optional(),
      stable: z.boolean().optional(),
      note: z.string().max(200).nullable().optional(),
    }),
  ),
});

const monthSchema = z.object({
  yearMonth: z.string(),
  staffKind: staffKindSchema.optional(),
});

async function rosterForbidden(
  session: Awaited<ReturnType<typeof getSatelliteSession>>,
) {
  return requireClinicPermission(session, CLINIC_PERMISSION.API_SANATORIUM_NURSE_ROSTER);
}

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/sanatorium/nurse-roster", async (httpReq, httpRes) => {
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
    const parsed = monthSchema.parse({
      yearMonth,
      staffKind: staffKindRaw === "LAB" ? "LAB" : "NURSE",
    });
    const locale = await readUiLocale(req);
    return sendJson(httpRes, await getOrCreateDutyRoster({ ...parsed, locale }));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.put("/api/sanatorium/nurse-roster", async (httpReq, httpRes) => {
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
    const body = saveSchema.parse(httpReq.body);
    const locale = await readUiLocale(req);
    const result = await saveDutyRoster({ ...body, locale });
    await recordClinicAudit(
      { userId: session!.sub, request: req },
      "staffDutyRoster",
      result.roster.id,
      "UPDATE",
      { yearMonth: body.yearMonth, lines: body.lines.length },
    );
    return sendJson(httpRes, result);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/sanatorium/nurse-roster", async (httpReq, httpRes) => {
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
    const body = z
      .object({
        action: z.enum(["approve", "copyPrevious"]),
        yearMonth: z.string(),
        staffKind: staffKindSchema.optional(),
      })
      .parse(httpReq.body);

    const locale = await readUiLocale(req);
    if (body.action === "copyPrevious") {
      const result = await copyDutyRosterFromPrevious({ ...body, locale });
      await recordClinicAudit(
        { userId: session!.sub, request: req },
        "staffDutyRoster",
        result.roster.id,
        "COPY_PREVIOUS",
        { yearMonth: body.yearMonth },
      );
      return sendJson(httpRes, result);
    }

    const result = await approveDutyRoster({
      yearMonth: body.yearMonth,
      staffKind: body.staffKind,
      locale,
      approvedByUserId: session!.sub,
    });
    await recordClinicAudit(
      { userId: session!.sub, request: req },
      "staffDutyRoster",
      result.roster.id,
      "APPROVE",
      { yearMonth: body.yearMonth },
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
