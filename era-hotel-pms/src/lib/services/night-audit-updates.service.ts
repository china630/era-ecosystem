import { prisma } from '@/lib/prisma';
import { listAuditLogs } from '@/lib/satellite-audit';

export type UpdateActionKind = 'ALL' | 'CANCEL' | 'EXTEND' | 'NOTE' | 'OTHER';

function classifyAction(
  status: string,
  latestAction: string | null,
): Exclude<UpdateActionKind, 'ALL'> {
  const a = (latestAction ?? '').toUpperCase();
  if (status === 'CANCELLED' || a.includes('CANCEL')) return 'CANCEL';
  if (
    a.includes('EXTEND') ||
    a.includes('DEPARTURE') ||
    a.includes('CHECK_OUT') ||
    a.includes('CHECKOUT')
  ) {
    return 'EXTEND';
  }
  if (a.includes('NOTE')) return 'NOTE';
  return 'OTHER';
}

export async function listNightAuditReservationUpdates(opts: {
  from: Date;
  to: Date;
  action?: UpdateActionKind;
}) {
  const toExclusive = new Date(opts.to);
  toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
  const actionFilter = opts.action ?? 'ALL';

  const [reservations, audit] = await Promise.all([
    prisma.reservation.findMany({
      where: { updatedAt: { gte: opts.from, lt: toExclusive } },
      include: {
        guest: { select: { fullName: true } },
        room: { select: { roomNumber: true } },
        roomType: { select: { code: true } },
        notes: { select: { noteType: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 300,
    }),
    listAuditLogs({
      entityType: 'Reservation',
      dateFrom: opts.from,
      dateTo: new Date(`${opts.to.toISOString().slice(0, 10)}T23:59:59.999Z`),
      limit: 300,
    }),
  ]);

  const auditByEntity = new Map<
    string,
    { action: string; createdAt: Date; userId: string | null }[]
  >();
  for (const row of audit) {
    const list = auditByEntity.get(row.entityId) ?? [];
    list.push({ action: row.action, createdAt: row.createdAt, userId: row.userId });
    auditByEntity.set(row.entityId, list);
  }

  const rows = reservations.map((r) => {
    const actions = auditByEntity.get(r.id) ?? [];
    const latest = actions[0];
    const noteHint = r.notes.some(
      (n) =>
        n.noteType.includes('NOTE') ||
        n.noteType === 'DEPARTURE_EXTENDED' ||
        n.noteType === 'CANCEL_NOTE',
    );
    let latestAction = latest?.action ?? null;
    if (!latestAction && r.status === 'CANCELLED') latestAction = 'CANCEL';
    if (!latestAction && noteHint) latestAction = 'NOTE';
    const actionKind = classifyAction(r.status, latestAction);

    return {
      id: r.id,
      status: r.status,
      guestName: r.guest.fullName,
      roomNumber: r.room?.roomNumber ?? null,
      roomTypeCode: r.roomType.code,
      checkInDate: r.checkInDate,
      checkOutDate: r.checkOutDate,
      updatedAt: r.updatedAt,
      latestAction,
      latestActionAt: latest?.createdAt ?? null,
      latestUserId: latest?.userId ?? null,
      actionCount: actions.length,
      actionKind,
    };
  });

  if (actionFilter === 'ALL') return rows;
  return rows.filter((r) => r.actionKind === actionFilter);
}

export function reservationUpdatesToCsv(
  rows: Awaited<ReturnType<typeof listNightAuditReservationUpdates>>,
): string {
  const header = [
    'id',
    'status',
    'guestName',
    'roomNumber',
    'roomTypeCode',
    'checkInDate',
    'checkOutDate',
    'updatedAt',
    'actionKind',
    'latestAction',
    'actionCount',
  ];
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [
    header.join(','),
    ...rows.map((r) =>
      [
        r.id,
        r.status,
        r.guestName,
        r.roomNumber,
        r.roomTypeCode,
        r.checkInDate instanceof Date
          ? r.checkInDate.toISOString().slice(0, 10)
          : r.checkInDate,
        r.checkOutDate instanceof Date
          ? r.checkOutDate.toISOString().slice(0, 10)
          : r.checkOutDate,
        r.updatedAt instanceof Date ? r.updatedAt.toISOString() : r.updatedAt,
        r.actionKind,
        r.latestAction,
        r.actionCount,
      ]
        .map(escape)
        .join(','),
    ),
  ];
  return lines.join('\n');
}
