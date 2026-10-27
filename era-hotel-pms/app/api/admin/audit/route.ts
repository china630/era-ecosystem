import { bakuDayBounds } from '@era/satellite-kit/time';
import { jsonOk, jsonError, handleRouteError } from '@/lib/api-utils';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listAuditLogs } from '@/lib/satellite-audit';

export async function GET(request: Request) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.REPORTS_READ);
    const url = new URL(request.url);
    const entityType = url.searchParams.get('entityType') ?? 'HTTP_MUTATION';
    if (!entityType.trim()) {
      return jsonError('entityType required', 400);
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
    return jsonOk(
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
  } catch (err) {
    return handleRouteError(err);
  }
}
