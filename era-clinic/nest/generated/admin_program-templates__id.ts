import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { programTemplateWriteSchema, shapeProgramTemplate, saveProgramTemplatePatch, countOpenInstancesForTemplate, countAnyInstancesForTemplate } from "@/domain/sanatorium/program-template-admin";
import { applyOpenCourseQuotaRecalc, previewOpenCourseQuotaRecalc, publishFixedAsDailyRate } from "@/domain/sanatorium/package-quota-recalc-admin";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.patch("/api/admin/program-templates/:id", async (httpReq, httpRes) => {
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
    const body = programTemplateWriteSchema.parse(httpReq.body);

    try {
      const row = await saveProgramTemplatePatch(id, body);
      const [openInstanceCount, pinInstanceCount] = await Promise.all([
        countOpenInstancesForTemplate(row.id),
        countAnyInstancesForTemplate(row.id),
      ]);
      const previousOpen =
        row.supersedesId != null
          ? await countOpenInstancesForTemplate(row.supersedesId)
          : 0;
      return sendJson(httpRes, {
        ...shapeProgramTemplate({ ...row, openInstanceCount, pinInstanceCount }),
        versionBumped: row.supersedesId != null,
        previousVersionOpenStays: previousOpen,
      });
    } catch (e) {
      const code = (e as Error & { code?: string }).code;
      if (code === "NOT_FOUND") return sendJson(httpRes, { error: "NOT_FOUND" }, 404);
      if (code === "RETIRED_TEMPLATE") {
        return sendJson(httpRes, 
          { error: "RETIRED_TEMPLATE", message: "Edit the current version only" },
          409,
        );
      }
      if (code === "INVALID_VALIDITY_RANGE") {
        return sendJson(httpRes, 
          {
            error: "INVALID_VALIDITY_RANGE",
            message: "Valid-to must not precede valid-from",
          },
          400,
        );
      }
      if (code === "COMPOSITION_REQUIRES_PROCEDURES") {
        return sendJson(httpRes, 
          {
            error: "COMPOSITION_REQUIRES_PROCEDURES",
            message: "Send procedures with knots when changing composition",
          },
          400,
        );
      }
      throw e;
    }
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/admin/program-templates/:id", async (httpReq, httpRes) => {
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
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const body = ((httpReq.body ?? {})) as Record<string, unknown>;

    try {
      if (action === "preview-recalc") {
        return sendJson(httpRes, await previewOpenCourseQuotaRecalc(id));
      }
      if (action === "apply-recalc") {
        return sendJson(httpRes, await applyOpenCourseQuotaRecalc(id));
      }
      if (action === "publish-daily") {
        const blocks = Array.isArray(body.blocks)
          ? (body.blocks as Array<{
              procedureCode: string;
              blockQuotaMode?: "DAILY_RATE" | "WEEKLY" | "PER_STAY";
              quotaPerNight?: number;
              quotaPerWeek?: number | null;
              dailyUseCap?: number | null;
              quotaTotal?: number;
            }>)
          : undefined;
        const row = await publishFixedAsDailyRate(id, {
          countSunday: body.countSunday === true,
          blocks,
        });
        const [openInstanceCount, pinInstanceCount] = await Promise.all([
          countOpenInstancesForTemplate(row.id),
          countAnyInstancesForTemplate(row.id),
        ]);
        return sendJson(httpRes, {
          ...shapeProgramTemplate({ ...row, openInstanceCount, pinInstanceCount }),
          versionBumped: row.supersedesId != null,
        });
      }
      return sendJson(httpRes, { error: "UNKNOWN_ACTION" }, 400);
    } catch (e) {
      const code = (e as Error & { code?: string }).code;
      if (
        code === "NOT_CURRENT" ||
        code === "TEMPLATE_NOT_FOUND" ||
        code === "NOT_DAILY_RATE" ||
        code === "ALREADY_DAILY_RATE"
      ) {
        return sendJson(httpRes, { error: code }, 409);
      }
      throw e;
    }
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
