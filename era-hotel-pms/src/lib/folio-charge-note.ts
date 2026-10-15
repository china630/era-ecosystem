const KEY = /^(night-audit|manual-room):(\d{4}-\d{2}-\d{2})$/;
const LEGACY =
  /^(Night audit room charge|Room charge|Room night|Manual room charge) (\d{4}-\d{2}-\d{2})$/;

export type RoomChargeNoteKind = 'night-audit' | 'manual-room';

export function roomChargeNote(kind: RoomChargeNoteKind, ymd: string): string {
  return `${kind}:${ymd}`;
}

const PACKAGE_NIGHT = /^(?:Package .+|Medical package) (\d{4}-\d{2}-\d{2})$/;

/** Date stamped on a medical package line (`Package … YYYY-MM-DD`). */
export function parsePackageNight(description: string): string | null {
  return PACKAGE_NIGHT.exec(description.trim())?.[1] ?? null;
}

export function parseRoomChargeNote(
  description: string,
): { kind: RoomChargeNoteKind; date: string } | null {
  const keyed = KEY.exec(description.trim());
  if (keyed) {
    return { kind: keyed[1] as RoomChargeNoteKind, date: keyed[2] };
  }
  const legacy = LEGACY.exec(description.trim());
  if (!legacy) return null;
  const kind: RoomChargeNoteKind =
    legacy[1] === 'Night audit room charge' ? 'night-audit' : 'manual-room';
  return { kind, date: legacy[2] };
}

export function displayRoomChargeNote(
  description: string,
  translate: (kind: RoomChargeNoteKind, date: string) => string,
): string {
  const parsed = parseRoomChargeNote(description);
  if (!parsed) return description;
  return translate(parsed.kind, parsed.date);
}
