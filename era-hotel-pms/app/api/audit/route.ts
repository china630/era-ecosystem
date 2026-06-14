import { jsonOk, jsonError, handleRouteError } from '@/lib/api-utils';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listAuditLogs } from '@/lib/satellite-audit';

export async function GET(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.REPORTS_READ);
    const url = new URL(request.url);
    const entityType = url.searchParams.get('entityType');
    if (!entityType) {
      return jsonError('entityType required', 400);
    }
    const entityId = url.searchParams.get('entityId') ?? undefined;
    const action = url.searchParams.get('action') ?? undefined;
    const dateFromParam = url.searchParams.get('dateFrom');
    const dateToParam = url.searchParams.get('dateTo');
    const dateFrom = dateFromParam ? new Date(dateFromParam) : undefined;
    const dateTo = dateToParam ? new Date(`${dateToParam}T23:59:59.999Z`) : undefined;
    const rows = await listAuditLogs({
      entityType,
      entityId,
      action,
      dateFrom,
      dateTo,
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
