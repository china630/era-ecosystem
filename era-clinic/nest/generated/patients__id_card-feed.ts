import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { getPatientHistoryPage, getPatientPlanPage, type HistoryLabFilter } from "@/domain/patient/patient-card.service";
import type { TimelineEventType } from "@/domain/patient/patient-timeline.service";
import { findPatientRefId } from "@/domain/patient/patient.service";
import { readUiLocale } from "@/lib/request-locale";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const querySchema = z.object({
  section: z.enum(["history", "plan"]).default("history"),
  types: z.string().optional(),
  labFilter: z.enum(["results", "pending", "all"]).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  offset: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  episode: z.string().optional(),
});

const TYPE_SET = new Set<TimelineEventType>([
  "appointment",
  "visit",
  "lab_order",
  "procedure",
  "episode",
]);

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/patients/:id/card-feed", async (httpReq, httpRes) => {
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
      section: url.searchParams.get("section") ?? undefined,
      types: url.searchParams.get("types") ?? undefined,
      labFilter: url.searchParams.get("labFilter") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      offset: url.searchParams.get("offset") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      episode: url.searchParams.get("episode") ?? undefined,
    });

    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    if (from && Number.isNaN(from.getTime())) return sendJson(httpRes, { error: "Invalid from" }, 400);
    if (to && Number.isNaN(to.getTime())) return sendJson(httpRes, { error: "Invalid to" }, 400);

    if (query.section === "plan") {
      const locale = await readUiLocale(req);
      return sendJson(httpRes, 
        await getPatientPlanPage(id, {
          offset: query.offset,
          limit: query.limit,
          from,
          to,
          episodeId: query.episode,
          locale,
        }),
      );
    }

    const rawTokens = query.types
      ? query.types
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    const isAll =
      rawTokens.length === 0 ||
      rawTokens.includes("all") ||
      rawTokens.every((t) => t === "all");

    let labCatalogKind: "panel" | "imaging" | undefined;
    const types: TimelineEventType[] = [];

    if (!isAll) {
      for (const token of rawTokens) {
        if (token === "lab_panel") {
          labCatalogKind = "panel";
          if (!types.includes("lab_order")) types.push("lab_order");
          continue;
        }
        if (token === "lab_imaging") {
          labCatalogKind = "imaging";
          if (!types.includes("lab_order")) types.push("lab_order");
          continue;
        }
        if (TYPE_SET.has(token as TimelineEventType)) {
          types.push(token as TimelineEventType);
        }
      }
    }

    return sendJson(httpRes, 
      await getPatientHistoryPage(id, {
        types: isAll || types.length === 0 ? undefined : types,
        labCatalogKind,
        labFilter: (query.labFilter ?? "all") as HistoryLabFilter,
        from,
        to,
        offset: query.offset,
        limit: query.limit,
        episodeId: query.episode,
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
