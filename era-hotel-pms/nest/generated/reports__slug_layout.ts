import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getReportBySlug } from '@/lib/reports/catalog';
import { parseReportLangParam } from '@/lib/reports/locale';
import { isImplementedReportSlug } from '@/lib/services/reports';
import { queryReportLayout } from '@/lib/services/reports/report-output';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

/**
 * Returns `{ layout }`: the same sections the PDF and Excel exports draw.
 * Lives under `/layout` because static analytics routes (`guest-demographics`, `agency-profitability`)
 * shadow `/api/reports/[slug]` for their slugs.
 */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/reports/:slug/layout", async (httpReq, httpRes) => {
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

  
    assertPermission(session, PERMISSIONS.REPORTS_READ);

    const { slug } = httpReq.params;
    const def = getReportBySlug(slug);
    if (!def) return sendJson(httpRes, { error: `Unknown report: ${slug}` }, 404);

    if (!isImplementedReportSlug(slug)) {
      return sendJson(httpRes, { error: `Report "${slug}" query not implemented` }, 501);
    }

    const url = new URL(request.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    if (!from || !to) return sendJson(httpRes, { error: 'Missing from/to query params' }, 400);

    const lang = parseReportLangParam(request);
    if (!lang.ok) return sendJson(httpRes, { error: lang.message }, 400);

    const dim = url.searchParams.get('dim') ?? undefined;
    const layout = await queryReportLayout(slug, from, to, lang.locale, dim ? { dim } : undefined);
    return sendJson(httpRes, { layout });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.get("/api/reports/:slug", async (httpReq, httpRes) => {
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

  
    assertPermission(session, PERMISSIONS.REPORTS_READ);

    const { slug } = httpReq.params;
    const def = getReportBySlug(slug);
    if (!def) return sendJson(httpRes, { error: `Unknown report: ${slug}` }, 404);

    if (!isImplementedReportSlug(slug)) {
      return sendJson(httpRes, { error: `Report "${slug}" query not implemented` }, 501);
    }

    const url = new URL(request.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    if (!from || !to) return sendJson(httpRes, { error: 'Missing from/to query params' }, 400);

    const lang = parseReportLangParam(request);
    if (!lang.ok) return sendJson(httpRes, { error: lang.message }, 400);

    const dim = url.searchParams.get('dim') ?? undefined;
    const layout = await queryReportLayout(slug, from, to, lang.locale, dim ? { dim } : undefined);
    return sendJson(httpRes, { layout });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
