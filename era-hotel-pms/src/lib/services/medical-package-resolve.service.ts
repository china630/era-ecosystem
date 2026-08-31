/**
 * Nafta Wave A — resolve commercial medical SKU from FO notes + agency.
 * Never uses Elektraweb Rate Code / medicalFlag as the source of truth.
 */

export const MEDICAL_PACKAGE_CODES = [
  "PKG-STANDART",
  "PKG-PREMIUM",
  "PKG-DERMO",
  "PKG-DETOKS",
] as const;

export type MedicalPackageCode = (typeof MEDICAL_PACKAGE_CODES)[number];

const CODE_SET = new Set<string>(MEDICAL_PACKAGE_CODES);

/** FO may omit PKG- prefix. */
const ALIASES: Record<string, MedicalPackageCode> = {
  STANDART: "PKG-STANDART",
  STANDARD: "PKG-STANDART",
  PREMIUM: "PKG-PREMIUM",
  DERMO: "PKG-DERMO",
  DETOKS: "PKG-DETOKS",
  DETOX: "PKG-DETOKS",
  "PKG-STANDART": "PKG-STANDART",
  "PKG-PREMIUM": "PKG-PREMIUM",
  "PKG-DERMO": "PKG-DERMO",
  "PKG-DETOKS": "PKG-DETOKS",
  "PKG-DETOX": "PKG-DETOKS",
};

export type ResolveGuestInput = {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
};

export type ResolveNoteInput = {
  noteType: string;
  text: string;
};

export type ResolveMedicalSkuInput = {
  notes: ResolveNoteInput[];
  agencyName?: string | null;
  guests: ResolveGuestInput[];
  /** Documented ignored — never used for SKU. */
  ratePlanCode?: string | null;
};

export type ResolveMedicalSkuResult = {
  /** Parallel to guests[]; null = unresolved for that pax. */
  perGuestCodes: (MedicalPackageCode | null)[];
  /** Set when every pax has the same non-null code. */
  unanimousCode: MedicalPackageCode | null;
  unresolved: boolean;
  /** Reservation-level stamp when agency/ERA-PKG applies to all. */
  reservationCode: MedicalPackageCode | null;
  /**
   * Pilot polish: leisure stays must not emit sanatorium check-in.
   * medical = at least one SKU; unresolved = medical intent unknown; leisure = Walkin leisure agency.
   */
  stayKind: "leisure" | "medical" | "unresolved";
};

export type AgencySkuRuleInput = {
  agencyNamePrefix: string;
  packageCode: MedicalPackageCode;
};

/**
 * True when agency is explicit non-medical Walkin leisure (hotel skips clinic lifecycle).
 */
export function isLeisureAgency(agencyName: string | null | undefined): boolean {
  if (!agencyName?.trim()) return false;
  const raw = agencyName.trim();
  return /^walkin\s+leisure/i.test(raw) || /walk[\s-]?in\s+leisure/i.test(raw);
}

export function normalizeMedicalPackageCode(
  raw: string | null | undefined,
): MedicalPackageCode | null {
  if (!raw) return null;
  const key = raw.trim().toUpperCase().replace(/\s+/g, " ");
  if (!key) return null;
  const compact = key.replace(/\s+/g, "");
  if (ALIASES[compact]) return ALIASES[compact];
  if (ALIASES[key]) return ALIASES[key];
  const withoutPkg = compact.replace(/^PKG-?/, "");
  if (ALIASES[withoutPkg]) return ALIASES[withoutPkg];
  if (CODE_SET.has(compact)) return compact as MedicalPackageCode;
  return null;
}

function guestDisplayName(g: ResolveGuestInput): string {
  if (g.fullName?.trim()) return g.fullName.trim();
  return [g.firstName, g.lastName].filter(Boolean).join(" ").trim();
}

function namesMatch(a: string, b: string): boolean {
  const na = a.toLowerCase().replace(/\s+/g, " ").trim();
  const nb = b.toLowerCase().replace(/\s+/g, " ").trim();
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const ta = na.split(" ");
  const tb = nb.split(" ");
  return ta.some((t) => t.length > 2 && tb.includes(t));
}

/** Ignore Channel-style room-type lines that look like «стандартный». */
function isChannelRoomTypeNoise(text: string): boolean {
  const t = text.toLowerCase();
  if (/room\s*detail/i.test(t)) return true;
  if (/стандартн(ый|ая|ое)\s+(двух|одно)/i.test(t)) return true;
  if (/standard\s+(double|twin|single)\s*(room)?/i.test(t) && !/era-pkg|paket|пакет/i.test(t)) {
    return true;
  }
  return false;
}

function noteTextByType(notes: ResolveNoteInput[], types: string[]): string {
  const set = new Set(types.map((t) => t.toUpperCase()));
  return notes
    .filter((n) => set.has(n.noteType.toUpperCase()) && n.text?.trim())
    .map((n) => n.text.trim())
    .join("\n");
}

function applyNamedCode(
  guests: ResolveGuestInput[],
  named: Map<number, MedicalPackageCode>,
  name: string,
  code: MedicalPackageCode,
): void {
  guests.forEach((g, i) => {
    if (namesMatch(guestDisplayName(g), name)) named.set(i, code);
  });
}

/**
 * Parse ERA-PKG block:
 * - `ERA-PKG STANDART` — same SKU for every pax (do not list names)
 * - `ERA-PKG\nSTANDART` — same, code on the next line
 * - `ERA-PKG\nAliyev: PREMIUM\nAliyeva: STANDART` — mix only
 *
 * If every named row in the block is the same SKU, that SKU applies to all pax
 * even when guest names do not match the card.
 */
function parseEraPkgBlock(
  text: string,
  guests: ResolveGuestInput[],
): {
  allCode: MedicalPackageCode | null;
  named: Map<number, MedicalPackageCode>;
  hit: boolean;
} {
  const named = new Map<number, MedicalPackageCode>();
  if (!text || isChannelRoomTypeNoise(text)) {
    return { allCode: null, named, hit: false };
  }
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let hit = false;
  let allCode: MedicalPackageCode | null = null;
  const blockCodes: MedicalPackageCode[] = [];

  for (const line of lines) {
    const eraMatch = line.match(/^ERA-PKG\s*[:\-]?\s*(.*)$/i);
    if (eraMatch) {
      hit = true;
      const rest = eraMatch[1].trim();
      if (!rest) continue;
      const namedLine = rest.match(/^(.+?)\s*[:\-]\s*(\S+)$/);
      if (namedLine) {
        const code = normalizeMedicalPackageCode(namedLine[2]);
        if (!code) continue;
        blockCodes.push(code);
        applyNamedCode(guests, named, namedLine[1].trim(), code);
      } else {
        const code = normalizeMedicalPackageCode(rest.split(/\s+/)[0]);
        if (code) {
          allCode = code;
          blockCodes.push(code);
        }
      }
      continue;
    }
    if (hit) {
      const namedLine = line.match(/^(.+?)\s*[:\-]\s*(\S+)$/);
      if (namedLine) {
        const code = normalizeMedicalPackageCode(namedLine[2]);
        if (!code) continue;
        blockCodes.push(code);
        applyNamedCode(guests, named, namedLine[1].trim(), code);
        continue;
      }
      const bare = normalizeMedicalPackageCode(line);
      if (bare) {
        allCode = allCode ?? bare;
        blockCodes.push(bare);
      }
    }
  }

  if (!hit) {
    const m = text.match(/ERA-PKG\s*[:\-]?\s*(\S+)/i);
    if (m) {
      hit = true;
      allCode = normalizeMedicalPackageCode(m[1]);
    }
  }

  if (!allCode) {
    const unique = [...new Set(blockCodes)];
    if (unique.length === 1) allCode = unique[0];
  }

  return { allCode, named, hit };
}

/** Phrases in Extra / Res / CIn notes. */
function parseUnstructuredPhrases(text: string): MedicalPackageCode | null {
  if (!text || isChannelRoomTypeNoise(text)) return null;
  const t = text.toLowerCase();
  // Mix prices → do not invent a single SKU from price alone
  if (/\d+\s*\+\s*\d+/.test(t) && /(?:dermo|detoks|detox|premium|standart)/i.test(t) === false) {
    // price-only mix like 180+96 without names — unresolved at phrase level
  }
  if (/dermo\s*paket|пакет\s*dermo|dermo\s*package/i.test(text)) return "PKG-DERMO";
  if (/detoks\s*paket|detox\s*paket|пакет\s*detoks|пакет\s*detox/i.test(text)) {
    return "PKG-DETOKS";
  }
  if (/premium\s*paket|пакет\s*premium|premium\s*package/i.test(text)) return "PKG-PREMIUM";
  if (/standart\s*paket|стандарт\s*пакет|standard\s*package|standart\s*package/i.test(text)) {
    return "PKG-STANDART";
  }
  // Named mix with two package words → null (reservation unresolved)
  const hits: MedicalPackageCode[] = [];
  if (/dermo/i.test(text) && /paket|пакет|package|pkg/i.test(text)) hits.push("PKG-DERMO");
  if (/detoks|detox/i.test(text) && /paket|пакет|package|pkg/i.test(text)) hits.push("PKG-DETOKS");
  if (/premium/i.test(text) && /paket|пакет|package|pkg/i.test(text)) hits.push("PKG-PREMIUM");
  if (/standart|стандарт|standard/i.test(text) && /paket|пакет|package|pkg/i.test(text)) {
    hits.push("PKG-STANDART");
  }
  const unique = [...new Set(hits)];
  if (unique.length === 1) return unique[0];
  return null;
}

/**
 * Agency name starts with Premium/Dermo/Detox or known walk-in labels → SKU for all pax.
 * Walkin leisure / Walkin medical without prefix → not a medical SKU.
 * Optional `rules` from AgencyMedicalSkuRule (DB) checked first (prefix match, case-insensitive).
 *
 * Token match (anywhere): `\bpremium\b`, `\bdermo\b`, `\bdetoks?\b`, Həmkarlar —
 * covers «Premium Naftalan Kamel», «Dermo Nafdan travel», etc.
 */
export function resolveAgencyPackageCode(
  agencyName: string | null | undefined,
  rules?: AgencySkuRuleInput[] | null,
): MedicalPackageCode | null {
  if (!agencyName?.trim()) return null;
  const raw = agencyName.trim();
  const lower = raw.toLowerCase();

  // Explicit non-medical leisure (do not invent SKU from tokens in leisure-only names)
  if (isLeisureAgency(raw)) return null;
  if (/^walkin\s+medical$/i.test(raw) || /^walk[\s-]?in\s+medical$/i.test(raw)) return null;
  // Agency labelled leisure (suffix) without Premium/Dermo/Detoks token
  if (/\bleisure\b/i.test(raw) && !/\b(premium|dermo|detoks|detox)\b/i.test(raw)) {
    return null;
  }

  // Editable DB rules (longest prefix first)
  if (rules?.length) {
    const sorted = [...rules].sort(
      (a, b) => b.agencyNamePrefix.length - a.agencyNamePrefix.length,
    );
    for (const rule of sorted) {
      const pref = rule.agencyNamePrefix.trim().toLowerCase();
      if (!pref) continue;
      if (lower.startsWith(pref) || lower.includes(pref)) {
        const code = normalizeMedicalPackageCode(rule.packageCode);
        if (code) return code;
      }
    }
  }

  // Həmkarlar / confederation → Standart (before generic medical default elsewhere)
  if (/h[əe]mkarlar|hemkarlar|həmkərlar/i.test(lower)) {
    return "PKG-STANDART";
  }

  // Token anywhere (Premium Naftalan…, Fecebook Dermo paket, Detox paket Walkin)
  if (/\bpremium\b/i.test(raw)) return "PKG-PREMIUM";
  if (/\bdermo\b/i.test(raw) || /fecebook\s+dermo|facebook\s+dermo/i.test(raw)) {
    return "PKG-DERMO";
  }
  if (/\bdetoks\b/i.test(raw) || /\bdetox\b/i.test(raw)) return "PKG-DETOKS";

  // Standart paket walk-in / standart medical label
  if (
    /\bstandart\b/i.test(raw) &&
    /paket|walkin|walk[\s-]?in|medical/i.test(raw)
  ) {
    return "PKG-STANDART";
  }

  return null;
}

export function resolveMedicalSku(
  input: ResolveMedicalSkuInput & { agencyRules?: AgencySkuRuleInput[] | null },
): ResolveMedicalSkuResult {
  const guests = input.guests.length > 0 ? input.guests : [{}];
  const perGuestCodes: (MedicalPackageCode | null)[] = guests.map(() => null);
  let anyHit = false;

  if (isLeisureAgency(input.agencyName) && !noteTextByType(input.notes, ["EXTRA_REQ"])) {
    return {
      perGuestCodes,
      unanimousCode: null,
      unresolved: true,
      reservationCode: null,
      stayKind: "leisure",
    };
  }

  const extraReq = noteTextByType(input.notes, ["EXTRA_REQ"]);
  const resNote = noteTextByType(input.notes, ["RES_NOTE"]);
  const cinNote = noteTextByType(input.notes, ["CIN_NOTE"]);
  const priceNote = noteTextByType(input.notes, ["PRICE_NOTE"]);

  // 1. ERA-PKG in Extra Req — one SKU on the ERA-PKG line covers every pax
  const era = parseEraPkgBlock(extraReq, guests);
  if (era.hit) {
    anyHit = true;
    const namedCodes = [...era.named.values()];
    const namedUnique = [...new Set(namedCodes)];
    const samePackageForAll =
      Boolean(era.allCode) && (namedUnique.length === 0 || namedUnique.every((c) => c === era.allCode));
    if (samePackageForAll && era.allCode) {
      perGuestCodes.fill(era.allCode);
    } else if (era.named.size > 0) {
      for (const [i, code] of era.named) perGuestCodes[i] = code;
      if (era.allCode) {
        perGuestCodes.forEach((c, i) => {
          if (c == null) perGuestCodes[i] = era.allCode;
        });
      }
    } else if (era.allCode) {
      perGuestCodes.fill(era.allCode);
    }
  }

  // 2. Unstructured Extra / Res / CIn (and Price as last phrase hint)
  if (!anyHit || perGuestCodes.every((c): boolean => c == null)) {
    const phraseSources = [extraReq, resNote, cinNote, priceNote];
    for (const src of phraseSources) {
      const phrase = parseUnstructuredPhrases(src);
      if (phrase) {
        anyHit = true;
        perGuestCodes.fill(phrase);
        break;
      }
      if (src && /(?:dermo|detoks|detox|premium).*(?:dermo|detoks|detox|premium|standart)/i.test(src)) {
        const multi = parseUnstructuredPhrases(src);
        if (!multi && /paket|пакет|package/i.test(src)) {
          anyHit = true;
          break;
        }
      }
    }
  }

  // 3–4. Agency prefix / Həmkarlar — all pax when Extra did not set codes
  if (perGuestCodes.every((c): boolean => c == null)) {
    const agencyCode = resolveAgencyPackageCode(input.agencyName, input.agencyRules);
    if (agencyCode) {
      anyHit = true;
      perGuestCodes.fill(agencyCode);
    }
  }

  const distinct = [...new Set(perGuestCodes.filter((c): c is MedicalPackageCode => c != null))];
  const unanimousCode =
    distinct.length === 1 && perGuestCodes.every((c) => c === distinct[0])
      ? distinct[0]
      : null;
  const unresolved = !unanimousCode;
  const reservationCode = unanimousCode;
  const stayKind: ResolveMedicalSkuResult["stayKind"] = distinct.length > 0
    ? "medical"
    : isLeisureAgency(input.agencyName)
      ? "leisure"
      : "unresolved";

  return {
    perGuestCodes,
    unanimousCode,
    unresolved,
    reservationCode,
    stayKind,
  };
}

/** Check-in / booking payload: unanimous resolved code or omit. */
export function programCodeForLifecycle(
  result: ResolveMedicalSkuResult,
): string | undefined {
  return result.unanimousCode ?? undefined;
}
