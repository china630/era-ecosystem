import { prisma } from "@/lib/prisma";
import {
  buildGuestNameLookup,
  resolveGuestIdFromName,
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

export function guestDisplayNameFromRow(row: Record<string, unknown>): string | null {
  const parts = [str(row.NAME), str(row.LNAME)].filter(Boolean).join(" ");
  return str(row.GUESTNAMES) ?? (parts || null);
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

/**
 * Link a live FOCP/detail reservation row to an existing Guest Card.
 * Prefer EW Guest Id, then the same name matcher as Excel import.
 * Do not attach to an arbitrary "first guest". Create only when EW Id is new.
 */
export async function resolveGuestIdForBridgeReservation(
  row: Record<string, unknown>,
): Promise<string> {
  const guestExt =
    str(row.RESGUESTID) ?? str(row.CONTACTGUESTID) ?? str(row.GUESTID);
  if (guestExt) {
    const byRef = await prisma.guest.findFirst({
      where: { externalRef: guestExt },
      select: { id: true },
    });
    if (byRef) return byRef.id;
  }

  const displayName = guestDisplayNameFromRow(row);
  const lookup = await loadLookup();
  const matched = resolveGuestIdFromName(displayName, lookup);
  if (matched) {
    if (guestExt) await backfillEwGuestId(matched, guestExt);
    return matched;
  }

  if (guestExt) {
    const name = displayName || `Guest ${guestExt}`;
    const created = await prisma.guest.create({
      data: {
        organizationId: bridgeRequestOrganizationId(),
        externalRef: guestExt,
        fullName: name,
        firstName: str(row.NAME) ?? undefined,
        lastName: str(row.LNAME) ?? undefined,
        phone: str(row.CONTACTPHONE) ?? str(row.PHONE) ?? undefined,
      },
    });
    invalidateBridgeGuestLookup();
    return created.id;
  }

  throw new Error(
    `Reservation guest not in ERA (no Guest Id, name ${displayName ?? "empty"}) — sync Guest Cards`,
  );
}
