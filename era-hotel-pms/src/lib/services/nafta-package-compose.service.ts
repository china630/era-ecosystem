/**
 * Package nightly sell from the room-type grid.
 * Same package: the occupancy cell of the charged room type.
 * Mixed packages: Standart at this room; other blocks at the standard-room cell
 * (Premium uses its own flat cell). No compiled 139/96 table.
 */

export type PackageSellCell = {
  code: string;
  roomCode: string;
  occupancy: number;
  amount: number;
};

export type ComposeBreakdownLine = {
  role: "main" | "companion";
  code: string;
  amount: number;
  note: string;
};

export type ComposeBreakdown = {
  total: number;
  lines: ComposeBreakdownLine[];
};

const STANDART = "PKG-STANDART";
const DERMO = "PKG-DERMO";
const DETOKS = "PKG-DETOKS";

export type RoomTypeFamily = "STANDARD" | "JUNIOR" | "DELUXE" | "TRIPLE" | "OTHER";

/** Map PMS and sheet codes onto one price family. */
export function roomTypeFamily(code: string): RoomTypeFamily {
  const c = code.trim().toUpperCase();
  if (/STRP|TRIPLE|TRPL/.test(c)) return "TRIPLE";
  if (/JSUIT|JUNIOR|^SUITE$|^JR$/.test(c)) return "JUNIOR";
  if (/DLX|DELUXE/.test(c)) return "DELUXE";
  if (/STWN|SDBL|STANDARD|STANDART|^STD$/.test(c)) return "STANDARD";
  return "OTHER";
}

/**
 * Named guests with an empty package follow the stay SKU.
 * An unnamed slot does not add a package occupant.
 */
export function paxCodesForCompose(
  pax: Array<{
    medicalPackageCode?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    guestId?: string | null;
  }>,
  stayPackageCode: string | null | undefined,
): string[] {
  const stay = (stayPackageCode ?? "").trim().toUpperCase();
  const codes: string[] = [];
  for (const guest of pax) {
    const own = (guest.medicalPackageCode ?? "").trim().toUpperCase();
    const named = Boolean(
      (guest.guestId ?? "").trim() ||
        (guest.firstName ?? "").trim() ||
        (guest.lastName ?? "").trim(),
    );
    if (own) codes.push(own);
    else if (named && stay) codes.push(stay);
  }
  return codes;
}

function cellAmount(
  cells: PackageSellCell[],
  code: string,
  roomCode: string,
  occupancy: number,
): number | null {
  const family = roomTypeFamily(roomCode);
  const hit = cells.find(
    (c) =>
      c.code.toUpperCase() === code &&
      roomTypeFamily(c.roomCode) === family &&
      c.occupancy === occupancy,
  );
  return hit ? hit.amount : null;
}

/** Standard-room cell. Premium has no standard row, so any cell of that occupancy is the flat price. */
function baseAmount(
  cells: PackageSellCell[],
  code: string,
  occupancy: number,
): number | null {
  const standard = cellAmount(cells, code, "STWN", occupancy);
  if (standard != null) return standard;
  const flat = cells.find(
    (c) => c.code.toUpperCase() === code && c.occupancy === occupancy,
  );
  return flat ? flat.amount : null;
}

function pushLine(
  lines: ComposeBreakdownLine[],
  role: ComposeBreakdownLine["role"],
  code: string,
  amount: number,
  note: string,
): number {
  lines.push({ role, code, amount, note });
  return amount;
}

export function composeNaftaPackageNightlySell(
  paxCodes: Array<string | null | undefined>,
  roomCode: string,
  cells: PackageSellCell[],
): number | null {
  return composeNaftaPackageNightlySellBreakdown(paxCodes, roomCode, cells)?.total ?? null;
}

export function composeNaftaPackageNightlySellBreakdown(
  paxCodes: Array<string | null | undefined>,
  roomCode: string,
  cells: PackageSellCell[],
): ComposeBreakdown | null {
  const known = new Set(cells.map((c) => c.code.toUpperCase()));
  const codes = paxCodes
    .map((c) => (c ? c.trim().toUpperCase() : null))
    .filter((c): c is string => !!c && c.startsWith("PKG-") && (known.size === 0 || known.has(c) || c.startsWith("PKG-")));
  const packageCodes = codes.filter((c) => c.startsWith("PKG-"));
  if (packageCodes.length === 0 || !roomCode.trim()) return null;

  const counts = new Map<string, number>();
  for (const code of packageCodes) counts.set(code, (counts.get(code) ?? 0) + 1);

  const lines: ComposeBreakdownLine[] = [];
  let total = 0;

  const take = (
    code: string,
    occupancy: number,
    atRoom: boolean,
    role: ComposeBreakdownLine["role"],
  ): boolean => {
    const amount = atRoom
      ? cellAmount(cells, code, roomCode, occupancy)
      : baseAmount(cells, code, occupancy);
    if (amount == null) return false;
    total += pushLine(
      lines,
      role,
      code,
      amount,
      atRoom ? `room occupancy-${occupancy}` : `base occupancy-${occupancy}`,
    );
    return true;
  };

  if (counts.size === 1) {
    const code = [...counts.keys()][0]!;
    const n = counts.get(code)!;
    if (!take(code, n, true, "main")) return null;
    return { total, lines };
  }

  const standart = counts.get(STANDART) ?? 0;
  if (standart > 0) {
    if (!take(STANDART, standart, true, "main")) return null;
    for (const [code, n] of counts) {
      if (code === STANDART) continue;
      if (!take(code, n, false, "companion")) return null;
    }
    return { total, lines };
  }

  const dermo = counts.get(DERMO) ?? 0;
  const detoks = counts.get(DETOKS) ?? 0;
  if (dermo === 1 && detoks === 1 && counts.size === 2) {
    if (!take(DERMO, 1, true, "main")) return null;
    if (!take(DETOKS, 1, false, "companion")) return null;
    return { total, lines };
  }

  const roomOwner = [...counts.entries()].find(([, n]) => n >= 2)?.[0];
  for (const [code, n] of counts) {
    const atRoom = roomOwner != null && code === roomOwner;
    if (!take(code, n, atRoom, atRoom ? "main" : "companion")) return null;
  }
  return { total, lines };
}
