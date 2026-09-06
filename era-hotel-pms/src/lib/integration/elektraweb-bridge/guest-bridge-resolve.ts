import { prisma } from "@/lib/prisma";
import {
  buildGuestNameLookup,
  collectGuestIdsForNamePart,
  splitReservationGuestParts,
  type GuestLookupRow,
} from "@/lib/import/resolve-reservation-guest";
import { bridgeRequestOrganizationId } from "@/lib/integration/elektraweb-bridge/config";
import { str } from "@/lib/integration/elektraweb-bridge/normalize";

const LOOKUP_TTL_MS = 30_000;

let lookupCache: { at: number; lookup: Map<string, Set<string>> } | null = null;

export function isBridgeGuestStubRef(ref: string | null | undefined): boolean {
  const v = ref?.trim() ?? "";
  if (!v) return true;
  return /^(import-guest-|ew-fo-name:)/i.test(v);
}

export function invalidateBridgeGuestLookup(): void {
  lookupCache = null;
}

/** Raw FOCP display (`A / B` kept intact for party sync). */
export function guestDisplayNameFromRow(row: Record<string, unknown>): string | null {
  const parts = [str(row.NAME), str(row.LNAME)].filter(Boolean).join(" ");
  return str(row.GUESTNAMES) ?? (parts || null);
}

/**
 * One person only — never the slash-joined FOCP party label.
 * Prefer NAME+LNAME; else first `Guest Name` fragment.
 */
export function primaryGuestNameFromRow(row: Record<string, unknown>): string | null {
  const fromParts = [str(row.NAME), str(row.LNAME)].filter(Boolean).join(" ");
  if (fromParts) return fromParts;
  const display = str(row.GUESTNAMES);
  if (!display) return null;
  const fragments = splitReservationGuestParts(display);
  const first = fragments[0] ?? display.split(/\s*\/\s*/)[0]?.trim();
  return first || null;
}

async function loadLookup(): Promise<Map<string, Set<string>>> {
  const now = Date.now();
  if (lookupCache && now - lookupCache.at < LOOKUP_TTL_MS) return lookupCache.lookup;
  const rows = (await prisma.guest.findMany({
    select: {
      id: true,
      fullName: true,
      firstName: true,
      lastName: true,
      middleName: true,
      externalRef: true,
    },
  })) as GuestLookupRow[];
  lookupCache = { at: now, lookup: buildGuestNameLookup(rows) };
  return lookupCache.lookup;
}

async function backfillEwGuestId(guestId: string, guestExt: string): Promise<void> {
  const current = await prisma.guest.findFirst({
    where: { id: guestId },
    select: { externalRef: true },
  });
  if (!current || current.externalRef === guestExt) return;
  if (!isBridgeGuestStubRef(current.externalRef)) return;
  const clash = await prisma.guest.findFirst({
    where: { externalRef: guestExt },
    select: { id: true },
  });
  if (clash) return;
  await prisma.guest.update({
    where: { id: guestId },
    data: { externalRef: guestExt },
  });
  invalidateBridgeGuestLookup();
}

function guestRichnessScore(g: {
  sex: string | null;
  birthDate: Date | null;
  phone: string | null;
  externalRef: string | null;
}): number {
  let s = 0;
  if (g.sex && g.sex !== "UNKNOWN") s += 3;
  if (g.birthDate) s += 3;
  if (g.phone?.trim()) s += 2;
  if (g.externalRef && !isBridgeGuestStubRef(g.externalRef)) s += 1;
  return s;
}

/** Prefer the Guest Card that already has sex/DOB/phone over a thin FOCP stub. */
export async function pickRichestGuestId(ids: string[]): Promise<string | null> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return null;
  if (unique.length === 1) return unique[0]!;
  const rows = await prisma.guest.findMany({
    where: { id: { in: unique } },
    select: {
      id: true,
      sex: true,
      birthDate: true,
      phone: true,
      externalRef: true,
    },
  });
  if (!rows.length) return null;
  rows.sort((a, b) => guestRichnessScore(b) - guestRichnessScore(a));
  return rows[0]?.id ?? null;
}

/**
 * Link a live FOCP/detail reservation row to an existing Guest Card (primary only).
 * Prefer EW Guest Id, then name-match. When several cards share a name (EW duplicate
 * Guest Ids), attach the reservation to the richest profile — do not spawn another thin stub.
 */
export async function resolveGuestIdForBridgeReservation(
  row: Record<string, unknown>,
): Promise<string> {
  const guestExt =
    str(row.RESGUESTID) ?? str(row.CONTACTGUESTID) ?? str(row.GUESTID);
  const primaryName = primaryGuestNameFromRow(row);
  const lookup = await loadLookup();

  const pool = new Set<string>();
  if (guestExt) {
    const byRef = await prisma.guest.findFirst({
      where: { externalRef: guestExt },
      select: { id: true },
    });
    if (byRef) pool.add(byRef.id);
  }
  if (primaryName) {
    for (const id of collectGuestIdsForNamePart(primaryName, lookup)) {
      pool.add(id);
    }
  }

  if (pool.size > 0) {
    const chosen = await pickRichestGuestId([...pool]);
    if (chosen) {
      if (guestExt) await backfillEwGuestId(chosen, guestExt);
      return chosen;
    }
  }

  if (guestExt) {
    const name = primaryName || `Guest ${guestExt}`;
    const tokens = name.trim().split(/\s+/).filter(Boolean);
    const firstName = str(row.NAME) ?? tokens[0] ?? undefined;
    const lastName =
      str(row.LNAME) ?? (tokens.length > 1 ? tokens[tokens.length - 1] : undefined);
    const created = await prisma.guest.create({
      data: {
        organizationId: bridgeRequestOrganizationId(),
        externalRef: guestExt,
        fullName: name,
        firstName,
        lastName,
        phone: str(row.CONTACTPHONE) ?? str(row.PHONE) ?? undefined,
      },
    });
    invalidateBridgeGuestLookup();
    return created.id;
  }

  throw new Error(
    `Reservation guest not in ERA (no Guest Id, name ${primaryName ?? "empty"}) — sync Guest Cards`,
  );
}
