import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { prisma } from '@/lib/prisma';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const { id } = await params;
    const [reservation, rows] = await Promise.all([
      prisma.reservation.findUnique({
        where: { id },
        select: { id: true, createdAt: true },
      }),
      prisma.satelliteAuditLog.findMany({
        where: { entityType: 'Reservation', entityId: id },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
    ]);
    if (!reservation) throw new Error('Reservation not found');
    const userIds = [...new Set(rows.map((row) => row.userId).filter((id): id is string => Boolean(id)))];
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, fullName: true },
        })
      : [];
    const names = new Map(users.map((user) => [user.id, user.fullName]));
    return jsonOk({
      createdAt: reservation.createdAt,
      entries: rows.map((row) => ({
        id: row.id,
        action: row.action,
        createdAt: row.createdAt,
        actor: row.userId ? names.get(row.userId) ?? row.userId : null,
        changes: safeJson(row.changesJson),
      })),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return {};
  }
}
