import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { todayBakuYmd } from "@/lib/baku-day";
import { normalizeSchedule } from "@/domain/reports/bonus-schedule";
import { computeBonusMonth, loadBonusReportPractitioners, loadBonusSchedule, saveBonusSchedule } from "@/domain/reports/bonus-compute";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;



const share = z.object({ refer: z.number(), perform: z.number() });
const table = z.object({
  consult: share,
  physio: share,
  massage: share,
  lab: share,
  func: share,
  lfk: share,
  cosmo: share,
});

const bodySchema = z.object({
  vatPercent: z.number(),
  profitTaxPercent: z.number(),
  fundPercent: z.number(),
  labPractitionerId: z.string().nullable(),
  usPractitionerId: z.string().nullable(),
  coefficients: z.record(z.string(), z.number()),
  memberIds: z.array(z.string()).optional(),
  walkIn: table,
  inHouse: table,
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/reports/bonus", async (httpReq, httpRes) => {
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

  
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_REPORTS_PROCEDURES);
    if (denied) return denied;
    const url = new URL(req.url);
    const from = (url.searchParams.get("from") ?? todayBakuYmd()).trim();
    const to = (url.searchParams.get("to") ?? from).trim();
    if (!DATE_RE.test(from) || !DATE_RE.test(to)) return sendJson(httpRes, { error: "from and to must be YYYY-MM-DD" }, 400);
    const schedule = await loadBonusSchedule();
    const [month, people] = await Promise.all([
      computeBonusMonth(from, to),
      loadBonusReportPractitioners(schedule),
    ]);
    return sendJson(httpRes, { schedule, month, people });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.put("/api/reports/bonus", async (httpReq, httpRes) => {
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

  
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_REPORTS_PROCEDURES);
    if (denied) return denied;
    const schedule = normalizeSchedule(bodySchema.parse(httpReq.body));
    await saveBonusSchedule(schedule);
    return sendJson(httpRes, { schedule });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
