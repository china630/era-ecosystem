import { prisma } from '@/lib/prisma';
import { hotelDateKey } from '@/lib/hotel-calendar';
import { recordHotelAudit } from '@/lib/satellite-audit';

export const RESERVATION_AUDIT_SECTIONS = [
  'card',
  'guests',
  'nights',
  'notes',
  'status',
  'folio',
] as const;

export type ReservationAuditSection = (typeof RESERVATION_AUDIT_SECTIONS)[number];

export type ReservationAuditSource = 'user' | 'elektraweb' | 'night_audit' | 'system';

export type ReservationAuditField = {
  key: string;
  from: string | null;
  to: string | null;
};

export type ReservationAuditPayload = {
  section: ReservationAuditSection;
  source: ReservationAuditSource;
  summary: string;
  fields: ReservationAuditField[];
  refs?: Record<string, string | null | undefined>;
};

export type ReservationAuditActor = {
  userId?: string | null;
  request?: Request;
  source?: ReservationAuditSource;
};

export type StayJournalEntry = {
  id: string;
  action: string;
  createdAt: string;
  actor: string | null;
  section: ReservationAuditSection;
  source: ReservationAuditSource;
  summary: string;
  fields: ReservationAuditField[];
  ipAddress?: string | null;
};

type SnapshotField = { key: string; section: ReservationAuditSection; value: string | null };

export type ReservationAuditSnapshot = {
  fields: SnapshotField[];
};

const SKIP_KEYS = new Set([
  'updatedAt',
  'createdAt',
  'totalAmount',
  'pricingBusinessDate',
]);

const SOURCES: ReservationAuditSource[] = ['user', 'elektraweb', 'night_audit', 'system'];

function ymd(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return hotelDateKey(value);
  const text = String(value);
  return text.length >= 10 ? text.slice(0, 10) : text;
}

function asText(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const text = String(value).trim();
  return text.length ? text : null;
}

function field(
  key: string,
  section: ReservationAuditSection,
  value: unknown,
): SnapshotField {
  return { key, section, value: asText(value) };
}

function guestLabel(row: {
  firstName?: string | null;
  lastName?: string | null;
  guest?: { fullName?: string | null } | null;
}): string {
  const name = [row.firstName, row.lastName].filter(Boolean).join(' ').trim();
  return name || row.guest?.fullName?.trim() || '';
}
export function snapshotReservation(row: {
  status?: string | null;
  checkInDate?: Date | string | null;
  checkOutDate?: Date | string | null;
  roomType?: { code?: string | null } | null;
  givenRoomType?: { code?: string | null } | null;
  room?: { roomNumber?: string | null } | null;
  ratePlan?: { code?: string | null } | null;
  mealPlan?: { code?: string | null } | null;
  paymentMethod?: string | null;
  billingMode?: string | null;
  source?: { code?: string | null; name?: string | null } | null;
  agency?: { code?: string | null; name?: string | null } | null;
  company?: { code?: string | null; name?: string | null } | null;
  salesContract?: { code?: string | null } | null;
  walkInProfileCode?: string | null;
  adults?: number | null;
  children11_6?: number | null;
  children5_2?: number | null;
  children1_0?: number | null;
  voucherNo?: string | null;
  resNo?: string | null;
  market?: string | null;
  segment?: string | null;
  vipType?: string | null;
  tripReason?: string | null;
  creditLimitAzn?: unknown;
  useManualRate?: boolean | null;
  manualDailyRate?: unknown;
  discountPercent?: unknown;
  isLocked?: boolean | null;
  roomTypeId?: string | null;
  givenRoomTypeId?: string | null;
  roomId?: string | null;
  ratePlanId?: string | null;
  mealPlanId?: string | null;
  agencyId?: string | null;
  companyId?: string | null;
  sourceId?: string | null;
  paxGuests?: Array<{
    id?: string | null;
    guestId?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    isPrimary?: boolean | null;
    ownsFolio?: boolean | null;
    medicalPackageCode?: string | null;
    birthDate?: Date | string | null;
    guest?: { fullName?: string | null } | null;
  }>;
  notes?: Array<{ noteType: string; text: string | null }>;
  notesMap?: Record<string, string>;
  dailyRates?: Array<{ stayDate: Date | string; amount: unknown; manualFlag?: boolean | null }>;
}): ReservationAuditSnapshot {
  const fields: SnapshotField[] = [
    field('status', 'status', row.status),
    field('checkInDate', 'card', ymd(row.checkInDate)),
    field('checkOutDate', 'card', ymd(row.checkOutDate)),
    field('roomType', 'card', row.roomType?.code ?? row.roomTypeId),
    field('givenRoomType', 'card', row.givenRoomType?.code ?? row.givenRoomTypeId),
    field('roomNumber', 'card', row.room?.roomNumber ?? row.roomId),
    field('ratePlan', 'card', row.ratePlan?.code ?? row.ratePlanId),
    field('mealPlan', 'card', row.mealPlan?.code ?? row.mealPlanId),
    field('paymentMethod', 'card', row.paymentMethod),
    field('billingMode', 'card', row.billingMode),
    field('source', 'card', row.source?.name ?? row.source?.code ?? row.sourceId),
    field('agency', 'card', row.agency?.name ?? row.agency?.code ?? row.agencyId),
    field('company', 'card', row.company?.name ?? row.company?.code ?? row.companyId),
    field('contract', 'card', row.salesContract?.code),
    field('walkInProfile', 'card', row.walkInProfileCode),
    field('adults', 'card', row.adults),
    field('children11_6', 'card', row.children11_6),
    field('children5_2', 'card', row.children5_2),
    field('children1_0', 'card', row.children1_0),
    field('voucherNo', 'card', row.voucherNo),
    field('resNo', 'card', row.resNo),
    field('market', 'card', row.market),
    field('segment', 'card', row.segment),
    field('vipType', 'card', row.vipType),
    field('tripReason', 'card', row.tripReason),
    field('creditLimitAzn', 'card', row.creditLimitAzn),
    field('useManualRate', 'card', row.useManualRate),
    field('manualDailyRate', 'card', row.manualDailyRate),
    field('discountPercent', 'card', row.discountPercent),
    field('isLocked', 'card', row.isLocked),
  ];

  const pax = row.paxGuests ?? [];
  fields.push(field('guestCount', 'guests', pax.length));
  for (const guest of pax) {
    const id = guest.guestId || guest.id || guestLabel(guest) || 'guest';
    fields.push(field(`guest.${id}.name`, 'guests', guestLabel(guest)));
    fields.push(field(`guest.${id}.primary`, 'guests', guest.isPrimary));
    fields.push(field(`guest.${id}.ownsFolio`, 'guests', guest.ownsFolio));
    fields.push(field(`guest.${id}.package`, 'guests', guest.medicalPackageCode));
    fields.push(field(`guest.${id}.birthDate`, 'guests', ymd(guest.birthDate ?? null)));
  }

  const notesMap = row.notesMap
    ?? Object.fromEntries((row.notes ?? []).map((note) => [note.noteType, note.text ?? '']));
  for (const [noteType, text] of Object.entries(notesMap)) {
    fields.push(field(`note.${noteType}`, 'notes', text));
  }

  for (const night of row.dailyRates ?? []) {
    const day = ymd(night.stayDate);
    if (!day) continue;
    fields.push(field(`night.${day}.amount`, 'nights', night.amount));
    fields.push(field(`night.${day}.manual`, 'nights', night.manualFlag));
  }

  return { fields: fields.filter((item) => !SKIP_KEYS.has(item.key)) };
}
export function diffReservationSnapshots(
  before: ReservationAuditSnapshot,
  after: ReservationAuditSnapshot,
): ReservationAuditField[] {
  const previous = new Map(before.fields.map((item) => [item.key, item]));
  const next = new Map(after.fields.map((item) => [item.key, item]));
  const keys = new Set([...previous.keys(), ...next.keys()]);
  const changes: ReservationAuditField[] = [];
  for (const key of keys) {
    const from = previous.get(key)?.value ?? null;
    const to = next.get(key)?.value ?? null;
    if (from === to) continue;
    changes.push({ key, from, to });
  }
  return changes;
}

export function sectionForField(key: string): ReservationAuditSection {
  if (key === 'status') return 'status';
  if (key.startsWith('guest.') || key === 'guestCount') return 'guests';
  if (key.startsWith('note.')) return 'notes';
  if (key.startsWith('night.')) return 'nights';
  if (key === 'amount' || key === 'revenueCode' || key === 'paymentMethod' || key === 'folioType') {
    return 'folio';
  }
  return 'card';
}

export type ParsedAuditFieldKey =
  | { kind: 'guest'; guestId: string; attr: string }
  | { kind: 'night'; ymd: string; attr: string }
  | { kind: 'note'; noteType: string }
  | { kind: 'plain'; key: string };

export const JOURNAL_ACTION_GROUPS = {
  create: ['CREATE'],
  update: ['UPDATE', 'AMEND', 'TARIFF_CHANGE'],
  checkin: ['CHECK_IN', 'CHECK_IN_EARLY'],
  checkout: ['CHECK_OUT', 'DEPART_GUEST'],
  room: ['ASSIGN_ROOM', 'RELOCATE', 'SWAP_ROOM', 'ROOM_MOVE'],
  money: [
    'CHARGE',
    'PAYMENT',
    'REFUND',
    'PAYMENT_VOID',
    'VOID',
    'DEPOSIT',
    'DEPOSIT_PAYOUT',
    'DEPOSIT_CARRY',
    'TRANSFER',
    'SETTLE',
    'GUEST_DEBT',
    'GUEST_DEBT_PAY',
    'MISSED_NIGHTS',
  ],
  cancel: ['CANCEL', 'NO_SHOW', 'RESTORE'],
} as const;

export type JournalActionGroup = keyof typeof JOURNAL_ACTION_GROUPS;

export function parseAuditFieldKey(key: string): ParsedAuditFieldKey {
  const guest = key.match(/^guest\.(.+)\.(name|primary|ownsFolio|package|birthDate)$/);
  if (guest) return { kind: 'guest', guestId: guest[1], attr: guest[2] };
  const night = key.match(/^night\.(\d{4}-\d{2}-\d{2})\.(amount|manual)$/);
  if (night) return { kind: 'night', ymd: night[1], attr: night[2] };
  if (key.startsWith('note.')) return { kind: 'note', noteType: key.slice(5) };
  return { kind: 'plain', key };
}

export function guestNameHint(fields: ReservationAuditField[], guestId: string): string | null {
  const row = fields.find((item) => item.key === `guest.${guestId}.name`);
  const text = row?.to || row?.from;
  return text && text.trim() ? text : null;
}

export function journalActionGroup(action: string): JournalActionGroup | null {
  for (const [group, codes] of Object.entries(JOURNAL_ACTION_GROUPS) as Array<
    [JournalActionGroup, readonly string[]]
  >) {
    if (codes.includes(action)) return group;
  }
  return null;
}

export function summarizeReservationAudit(
  action: string,
  fields: ReservationAuditField[],
): string {
  if (action === 'CREATE') return action;
  if (fields.length === 0) return action;
  const guestCount = fields.find((item) => item.key === 'guestCount');
  const room = fields.find((item) => item.key === 'roomNumber');
  const status = fields.find((item) => item.key === 'status');
  const nights = fields.filter((item) => /^night\.\d{4}-\d{2}-\d{2}\.amount$/.test(item.key));
  const amount = fields.find((item) => item.key === 'amount');
  const parts: string[] = [];
  if (status) parts.push(`status: ${status.from ?? '—'} → ${status.to ?? '—'}`);
  if (guestCount) parts.push(`guests: ${guestCount.from ?? '—'} → ${guestCount.to ?? '—'}`);
  if (room) parts.push(`room: ${room.from ?? '—'} → ${room.to ?? '—'}`);
  if (nights.length === 1) {
    parts.push(`night: ${nights[0]!.from ?? '—'} → ${nights[0]!.to ?? '—'}`);
  } else if (nights.length > 1) {
    parts.push(`nights: ${nights.length}`);
  }
  if (amount) parts.push(`amount: ${amount.to ?? amount.from ?? '—'}`);
  if (parts.length === 0) {
    const first = fields[0]!;
    parts.push(`${first.key}: ${first.from ?? '—'} → ${first.to ?? '—'}`);
  }
  return `${action} · ${parts.slice(0, 3).join('; ')}`;
}

export function parseReservationAuditChanges(raw: unknown): {
  section: ReservationAuditSection;
  source: ReservationAuditSource;
  summary: string | null;
  fields: ReservationAuditField[];
} {
  if (!raw || typeof raw !== 'object') {
    return { section: 'card', source: 'user', summary: null, fields: [] };
  }
  const row = raw as Record<string, unknown>;
  const fields: ReservationAuditField[] = [];
  if (Array.isArray(row.fields)) {
    for (const item of row.fields) {
      if (!item || typeof item !== 'object') continue;
      const value = item as Record<string, unknown>;
      if (typeof value.key !== 'string') continue;
      fields.push({
        key: value.key,
        from: value.from == null ? null : String(value.from),
        to: value.to == null ? null : String(value.to),
      });
    }
  } else if (row.fields && typeof row.fields === 'object') {
    for (const [key, value] of Object.entries(row.fields as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue;
      const pair = value as { from?: unknown; to?: unknown };
      fields.push({
        key,
        from: pair.from == null ? null : String(pair.from),
        to: pair.to == null ? null : String(pair.to),
      });
    }
  }
  if (fields.length === 0) {
    for (const key of ['amount', 'note', 'reason', 'paymentMethod', 'nights', 'total', 'revenueCode']) {
      if (row[key] != null && typeof row[key] !== 'object') {
        fields.push({ key, from: null, to: String(row[key]) });
      }
    }
  }
  const section = RESERVATION_AUDIT_SECTIONS.includes(row.section as ReservationAuditSection)
    ? (row.section as ReservationAuditSection)
    : fields[0]
      ? sectionForField(fields[0].key)
      : 'card';
  const source = SOURCES.includes(row.source as ReservationAuditSource)
    ? (row.source as ReservationAuditSource)
    : 'user';
  return {
    section,
    source,
    summary: typeof row.summary === 'string' ? row.summary : null,
    fields,
  };
}

const SNAPSHOT_INCLUDE = {
  room: { select: { roomNumber: true } },
  roomType: { select: { code: true } },
  givenRoomType: { select: { code: true } },
  ratePlan: { select: { code: true } },
  mealPlan: { select: { code: true } },
  agency: { select: { code: true, name: true } },
  company: { select: { code: true, name: true } },
  source: { select: { code: true, name: true } },
  salesContract: { select: { code: true } },
  paxGuests: {
    orderBy: { sortOrder: 'asc' as const },
    include: { guest: { select: { fullName: true } } },
  },
  notes: { select: { noteType: true, text: true } },
  dailyRates: {
    orderBy: { stayDate: 'asc' as const },
    select: { stayDate: true, amount: true, manualFlag: true },
  },
};

export async function loadReservationAuditSnapshot(
  reservationId: string,
): Promise<ReservationAuditSnapshot | null> {
  const row = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: SNAPSHOT_INCLUDE,
  });
  return row ? snapshotReservation(row) : null;
}

export async function recordReservationAudit(
  reservationId: string,
  action: string,
  actor: ReservationAuditActor | undefined,
  payload: Omit<ReservationAuditPayload, 'summary'> & { summary?: string },
): Promise<void> {
  const fields = payload.fields ?? [];
  const source = actor?.source ?? payload.source ?? 'user';
  const summary = payload.summary ?? summarizeReservationAudit(action, fields);
  await recordHotelAudit(
    { userId: actor?.userId, request: actor?.request },
    'Reservation',
    reservationId,
    action,
    {
      section: payload.section,
      source,
      summary,
      fields,
      ...(payload.refs ? { refs: payload.refs } : {}),
    },
  );
}

export async function recordReservationDiff(
  reservationId: string,
  action: string,
  before: ReservationAuditSnapshot | null,
  after: ReservationAuditSnapshot | null,
  actor?: ReservationAuditActor,
  extras?: { section?: ReservationAuditSection; refs?: Record<string, string | null | undefined> },
): Promise<void> {
  if (!after) return;
  const fields = before
    ? diffReservationSnapshots(before, after)
    : after.fields.map((item) => ({ key: item.key, from: null, to: item.value }));
  if (fields.length === 0) return;
  const sections = new Set(fields.map((item) => sectionForField(item.key)));
  const section =
    extras?.section ??
    (sections.size === 1 ? [...sections][0]! : sections.has('status') ? 'status' : 'card');
  await recordReservationAudit(reservationId, action, actor, {
    section,
    source: actor?.source ?? 'user',
    fields,
    refs: extras?.refs,
  });
}
function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return {};
  }
}

export async function listReservationJournal(
  reservationId: string,
  opts?: { includeIp?: boolean; section?: string; source?: string },
): Promise<{ createdAt: Date; entries: StayJournalEntry[] }> {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      createdAt: true,
      roomChanges: {
        orderBy: { effectiveAt: 'asc' },
        include: { fromRoom: true, toRoom: true },
      },
      tariffChanges: { orderBy: { effectiveAt: 'asc' } },
    },
  });
  if (!reservation) throw new Error('Reservation not found');

  const rows = await prisma.satelliteAuditLog.findMany({
    where: { entityType: 'Reservation', entityId: reservationId },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  const userIds = [...new Set(rows.map((row) => row.userId).filter((id): id is string => Boolean(id)))];
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, fullName: true },
      })
    : [];
  const names = new Map(users.map((user) => [user.id, user.fullName]));

  const entries: StayJournalEntry[] = rows.map((row) => {
    const parsed = parseReservationAuditChanges(safeJson(row.changesJson));
    return {
      id: row.id,
      action: row.action,
      createdAt: row.createdAt.toISOString(),
      actor: row.userId ? names.get(row.userId) ?? row.userId : null,
      section: parsed.section,
      source: parsed.source,
      summary: parsed.summary ?? summarizeReservationAudit(row.action, parsed.fields),
      fields: parsed.fields,
      ...(opts?.includeIp ? { ipAddress: row.ipAddress } : {}),
    };
  });

  if (!entries.some((row) => row.action === 'CREATE')) {
    entries.push({
      id: `created:${reservation.id}`,
      action: 'CREATE',
      createdAt: reservation.createdAt.toISOString(),
      actor: null,
      section: 'status',
      source: 'system',
      summary: 'CREATE',
      fields: [],
    });
  }

  const roomActions = new Set(['RELOCATE', 'ASSIGN_ROOM', 'SWAP_ROOM', 'ROOM_MOVE']);
  for (const move of reservation.roomChanges) {
    const from = move.fromRoom?.roomNumber ?? null;
    const to = move.toRoom?.roomNumber ?? null;
    const already = entries.some(
      (row) =>
        roomActions.has(row.action) &&
        row.fields.some((fieldRow) => fieldRow.key === 'roomNumber' && fieldRow.from === from && fieldRow.to === to),
    );
    if (already) continue;
    entries.push({
      id: `roomChange:${move.id}`,
      action: 'ROOM_MOVE',
      createdAt: move.effectiveAt.toISOString(),
      actor: null,
      section: 'card',
      source: 'system',
      summary: summarizeReservationAudit('ROOM_MOVE', [
        { key: 'roomNumber', from, to },
      ]),
      fields: [
        { key: 'roomNumber', from, to },
        ...(move.reasonCode ? [{ key: 'reason', from: null, to: move.reasonCode }] : []),
      ],
    });
  }

  for (const tariff of reservation.tariffChanges) {
    const already = entries.some(
      (row) =>
        (row.action === 'AMEND' || row.action === 'UPDATE') &&
        row.fields.some(
          (fieldRow) =>
            fieldRow.key === 'ratePlan' &&
            fieldRow.from === (tariff.fromCode ?? null) &&
            fieldRow.to === (tariff.toCode ?? null),
        ),
    );
    if (already) continue;
    entries.push({
      id: `tariffChange:${tariff.id}`,
      action: 'TARIFF_CHANGE',
      createdAt: tariff.effectiveAt.toISOString(),
      actor: null,
      section: 'nights',
      source: 'system',
      summary: summarizeReservationAudit('TARIFF_CHANGE', [
        { key: 'ratePlan', from: tariff.fromCode ?? null, to: tariff.toCode ?? null },
      ]),
      fields: [
        { key: 'ratePlan', from: tariff.fromCode ?? null, to: tariff.toCode ?? null },
      ],
    });
  }

  const filtered = entries.filter((row) => {
    if (opts?.section && row.section !== opts.section) return false;
    if (opts?.source && row.source !== opts.source) return false;
    return true;
  });
  filtered.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return { createdAt: reservation.createdAt, entries: filtered };
}