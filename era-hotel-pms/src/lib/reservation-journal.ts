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
