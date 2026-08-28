/**
 * Cutover / EW identity helpers: FIN vs passport, ISO nationality, FIO order.
 * MDM stores one fullNameCipher — patronymic lives in that string (given + patronymic + surname).
 */

const FIN_RE = /^[0-9A-HJ-NP-Za-hj-np-z]{7}$/;

const NATIONALITY_TO_ISO: Record<string, string> = {
  AZ: "AZ",
  AZE: "AZ",
  AZERBAIJAN: "AZ",
  AZERBAIJANI: "AZ",
  AZERBAYCAN: "AZ",
  RU: "RU",
  RUS: "RU",
  RUSSIA: "RU",
  RUSSIAN: "RU",
  KZ: "KZ",
  KAZ: "KZ",
  KAZAKHSTAN: "KZ",
  KAZAKH: "KZ",
  UZ: "UZ",
  UZB: "UZ",
  UZBEKISTAN: "UZ",
  UZBEK: "UZ",
  UZBEKISTANI: "UZ",
  TR: "TR",
  TUR: "TR",
  TURKEY: "TR",
  TURKIYE: "TR",
  "TÜRKIYE": "TR",
  IL: "IL",
  ISR: "IL",
  ISRAEL: "IL",
  MD: "MD",
  MDA: "MD",
  MOLDOVA: "MD",
  MOLDOVAN: "MD",
  LV: "LV",
  LAT: "LV",
  LATVIA: "LV",
  LATVIAN: "LV",
  EE: "EE",
  EST: "EE",
  ESTONIA: "EE",
  ESTONIAN: "EE",
  TJ: "TJ",
  TJK: "TJ",
  TAJIKISTAN: "TJ",
  BY: "BY",
  BLR: "BY",
  BELARUS: "BY",
  GE: "GE",
  GEO: "GE",
  GEORGIA: "GE",
  UA: "UA",
  UKR: "UA",
  UKRAINE: "UA",
};

export function isValidAzFin(value: string): boolean {
  return FIN_RE.test(value.trim());
}

export function mapNationalityToIso(raw: string | null | undefined): string {
  const s = (raw ?? "").trim();
  if (!s) return "AZ";
  const folded = s
    .toUpperCase()
    .replace(/İ/g, "I")
    .replace(/Ə/g, "E")
    .replace(/Ü/g, "U")
    .replace(/Ö/g, "O")
    .replace(/Ş/g, "S")
    .replace(/Ç/g, "C")
    .replace(/[^A-Z]/g, "");
  if (NATIONALITY_TO_ISO[folded]) return NATIONALITY_TO_ISO[folded];
  if (/^[A-Z]{2}$/.test(folded)) return folded;
  return "AZ";
}

/**
 * National Id No → FIN only when it is a valid AZ FIN.
 * Passport No → passport, unless the cell is actually a FIN (reception dump).
 * A non-FIN National Id (AA…, long numbers) is treated as a misfiled passport.
 */
export function classifyPersonDocuments(input: {
  nationalId?: string | null;
  passportNo?: string | null;
}): { fin?: string; passport?: string } {
  const national = input.nationalId?.trim() || "";
  const passCol = input.passportNo?.trim() || "";
  let fin: string | undefined;
  let passport: string | undefined;

  if (national) {
    if (isValidAzFin(national)) fin = national.toUpperCase();
    else passport = national;
  }
  if (passCol) {
    if (isValidAzFin(passCol)) {
      if (!fin) fin = passCol.toUpperCase();
    } else {
      passport = passCol;
    }
  }
  return { fin, passport };
}

export function foldPersonName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/ə/g, "e")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitGivenAndPatronymic(givenField: string | null | undefined): {
  firstName: string | null;
  middleName: string | null;
} {
  const parts = (givenField ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: null, middleName: null };
  if (parts.length === 1) return { firstName: parts[0], middleName: null };
  return { firstName: parts[0], middleName: parts.slice(1).join(" ") };
}

/** Display / MDM order: given name, patronymic, surname. */
export function composePersonFullName(
  firstName?: string | null,
  middleName?: string | null,
  lastName?: string | null,
): string {
  return [firstName, middleName, lastName].map((p) => p?.trim()).filter(Boolean).join(" ");
}

function tokens(name: string): string[] {
  return name.trim().split(/\s+/).filter(Boolean);
}

/**
 * Fill-not-clear for MDM fullName: if incoming has extra tokens (patronymic), use it.
 * Never shrink an existing richer name.
 */
export function mergeFullNameWithPatronymic(
  existing: string | null | undefined,
  incoming: string,
): string {
  const next = incoming.trim();
  const prev = (existing ?? "").trim();
  if (!prev) return next;
  if (!next) return prev;
  if (foldPersonName(prev) === foldPersonName(next)) return prev;
  if (tokens(next).length > tokens(prev).length) return next;
  return prev;
}

export function phoneMatchKey(value: string | null | undefined): string | null {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length < 7) return null;
  return digits.slice(-9);
}
