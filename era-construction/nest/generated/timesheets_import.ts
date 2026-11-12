import type { TimesheetEntry } from "@prisma/client";
import { requestOrganizationId } from "@/lib/request-organization";
import { z } from "zod";
import { isConstructionWorkingDay } from "@/lib/production-calendar";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { WORKFORCE_TIMESHEET_BATCH_IMPORTED } from "@era/contracts";
import { createTimesheetEntriesBatch } from "@/lib/timesheets.service";
import { enterConstructionStaff, constructionNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithConstructionTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  projectId: z.string(),
  rows: z.array(
    z.object({
      workerRef: z.string(),
      cpEmploymentId: z.string().uuid().optional(),
      hours: z.number().min(0),
      workDate: z.string(),
    }),
  ),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/timesheets/import", async (httpReq, httpRes) => {
    if (!(await enterConstructionStaff(httpReq, httpRes))) return;
    try {
      const session = await constructionNestSession(httpReq);
      const web = await runWithConstructionTenant(session, async () => {
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
    const accepted: typeof body.rows = [];
    const skipped: Array<{ row: (typeof body.rows)[number]; reason: string }> = [];
    const warnings: string[] = [];

    for (const row of body.rows) {
      const iso = row.workDate.slice(0, 10);
      const working = await isConstructionWorkingDay(iso);
      if (!working) {
        skipped.push({ row, reason: "NON_WORKING_DAY" });
        warnings.push(`${iso}: non-working day (${row.workerRef})`);
        continue;
      }
      accepted.push(row);
    }

    const created = await createTimesheetEntriesBatch(
      accepted.map((row) => ({
        projectId: body.projectId,
        workerRef: row.workerRef,
        cpEmploymentId: row.cpEmploymentId ?? null,
        hours: row.hours,
        workDate: new Date(row.workDate),
      })),
    );

    const linked = created.filter((c: TimesheetEntry) => c.cpEmploymentId);
    if (linked.length > 0) {
      await dispatchSatelliteEvent({
        type: WORKFORCE_TIMESHEET_BATCH_IMPORTED,
        payload: {
          organizationId: requestOrganizationId(),
          projectId: body.projectId,
          entries: linked.map((c: TimesheetEntry) => ({
            cpEmploymentId: c.cpEmploymentId ?? undefined,
            workerRef: c.workerRef,
            hours: Number(c.hours),
            workDate: c.workDate.toISOString().slice(0, 10),
            sourceEntryId: c.id,
          })),
        },
      });
    }

    return sendJson(httpRes, 
      {
        imported: created.length,
        skipped: skipped.length,
        warnings,
        skippedRows: skipped,
        eventPublished: linked.length > 0,
      },
      201,
    );
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
