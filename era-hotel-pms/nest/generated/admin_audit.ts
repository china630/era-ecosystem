import { bakuDayBounds } from '@era/satellite-kit/time';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listAuditLogs } from '@/lib/satellite-audit';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/audit", async (httpReq, httpRes) => {
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
    const url = new URL(request.url);
    const entityType = url.searchParams.get('entityType') ?? 'HTTP_MUTATION';
    if (!entityType.trim()) {
      return sendJson(httpRes, { error: 'entityType required' }, 400);
    }
    const entityId = url.searchParams.get('entityId') ?? undefined;
    const action = url.searchParams.get('action') ?? undefined;
    const userId = url.searchParams.get('userId') ?? undefined;
    const dateFromParam = url.searchParams.get('dateFrom');
    const dateToParam = url.searchParams.get('dateTo');
    const dateFrom =
      dateFromParam && /^\d{4}-\d{2}-\d{2}$/.test(dateFromParam)
        ? bakuDayBounds(dateFromParam).start
        : dateFromParam
          ? new Date(dateFromParam)
          : undefined;
    const dateTo =
      dateToParam && /^\d{4}-\d{2}-\d{2}$/.test(dateToParam)
        ? bakuDayBounds(dateToParam).end
        : dateToParam
          ? new Date(`${dateToParam}T23:59:59.999Z`)
          : undefined;
    const limit = Math.min(Number(url.searchParams.get('limit') ?? '100'), 500);
    const rows = await listAuditLogs({
      entityType,
      entityId,
      action,
      userId,
      dateFrom,
      dateTo,
      limit,
    });
    return sendJson(httpRes, 
      rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        entityType: r.entityType,
        entityId: r.entityId,
        action: r.action,
        changes: JSON.parse(r.changesJson),
        createdAt: r.createdAt.toISOString(),
      })),
    );
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
