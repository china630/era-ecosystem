/**
 * WO nahiye → S matcher. Port of scripts/nafta-cutover/nahiye-s-match.cjs.
 * Coverage CLI keeps the CJS file; golden tests compare both.
 */

export type NahiyeMatchCatalog = {
  orderFieldsNotZones?: Array<{ code: string; wo?: string[] }>;
  zones?: Array<{ code: string; woAliases?: string[] }>;
  compositeMaps?: Array<{ wo: string; chips?: string[]; flags?: string[] }>;
  matchRules?: {
    stopWords?: string[];
    applicationCutImplies?: { SOCK?: string; GLOVE?: string };
  };
};

export type NahiyeMatchResult = {
  chips: string[];
  flags: string[];
  residue: string;
  via: "composite" | "greedy";
};

export type NahiyeBucket = "mapped" | "flags-only" | "partial" | "unknown" | "empty-text";

export function norm(s: unknown): string {
  return String(s)
    .normalize("NFC")
    .replace(/\u00a0/g, " ")
    .replace(/[ıIİi]/g, (ch) => {
      if (ch === "I" || ch === "İ") return "i";
      if (ch === "ı") return "i";
      return ch;
    })
    .toLocaleLowerCase("az")
    .replace(/[.,;:()]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function fold(s: unknown): string {
  return norm(s)
    .replace(/ə/g, "e")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ğ/g, "g")
    .replace(/ç/g, "c")
    .replace(/ş/g, "s")
    .replace(/-/g, " ")
    .replace(/[+/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function indexWhole(hay: string, needle: string): number {
  if (!needle) return -1;
  let from = 0;
  while (from <= hay.length) {
    const i = hay.indexOf(needle, from);
    if (i < 0) return -1;
    const before = i === 0 || hay[i - 1] === " ";
    const after = i + needle.length === hay.length || hay[i + needle.length] === " ";
    if (before && after) return i;
    from = i + 1;
  }
  return -1;
}

export function bucketOf(m: { chips: string[]; flags: string[]; residue: string }): NahiyeBucket {
  if (m.chips.length && !m.residue) return "mapped";
  if (!m.chips.length && !m.residue && m.flags.length) return "flags-only";
  if (m.chips.length && m.residue) return "partial";
  if (!m.chips.length && m.residue) return "unknown";
  return "empty-text";
}

function skuHint(procedureName: string | undefined): string {
  const n = fold(procedureName || "");
  if (!n) return "";
  if (/\b(trunda|turunda)\b/.test(n) || /\bburun\b/.test(n)) return "nose";
  if (/inqalyasiya/.test(n)) return "nose";
  if (/massaj 30|ufb|parafin.*butun|yod.brom|hidromasaj|bukme/.test(n)) return "whole";
  return "";
}

function stripWhole(rest: string, needle: string): string {
  let i: number;
  while ((i = indexWhole(rest, needle)) >= 0) {
    rest = `${rest.slice(0, i)} ${rest.slice(i + needle.length)}`.replace(/\s+/g, " ").trim();
  }
  return rest;
}

function resolveButun(
  rest: string,
  chips: string[],
  addChip: (c: string) => void,
  procedureName: string | undefined,
): string {
  if (indexWhole(rest, "butun") < 0) return rest;
  if (chips.length) return stripWhole(rest, "butun");
  const hint = skuHint(procedureName);
  if (hint === "nose") {
    addChip("ZONE-FACE");
    return stripWhole(rest, "butun");
  }
  if (hint === "whole") {
    addChip("ZONE-FULL-BODY");
    return stripWhole(rest, "butun");
  }
  return rest;
}

export function buildMatcher(cat: NahiyeMatchCatalog): {
  match: (text: unknown, opts?: { procedureName?: string }) => NahiyeMatchResult;
} {
  const fields = cat.orderFieldsNotZones || [];
  const fieldPhrases: Array<{ n: string; code: string; raw: string }> = [];
  for (const f of fields) {
    for (const w of f.wo || []) {
      const n = fold(w);
      if (n) fieldPhrases.push({ n, code: f.code, raw: w });
    }
  }
  fieldPhrases.sort((a, b) => b.n.length - a.n.length);

  const aliases: Array<{ n: string; code: string }> = [];
  for (const z of cat.zones || []) {
    for (const w of z.woAliases || []) {
      const n = fold(w);
      if (n) aliases.push({ n, code: z.code });
    }
  }
  aliases.sort((a, b) => b.n.length - a.n.length);

  const composites = (cat.compositeMaps || []).map((c) => ({
    n: fold(c.wo),
    chips: c.chips || [],
    flags: c.flags || [],
  }));

  const stop = (
    (cat.matchRules && cat.matchRules.stopWords) || [
      "nahiyesine",
      "nahiyesi",
      "nahiyyesi",
      "nahiye",
      "ve",
    ]
  )
    .map((s) => fold(s))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  const implies = (cat.matchRules && cat.matchRules.applicationCutImplies) || {};

  function match(text: unknown, opts?: { procedureName?: string }): NahiyeMatchResult {
    const original = fold(text);
    const chips: string[] = [];
    const flags: string[] = [];
    const addChip = (c: string) => {
      if (c && !chips.includes(c)) chips.push(c);
    };
    const addFlag = (c: string) => {
      if (c && !flags.includes(c)) flags.push(c);
    };

    const hit = composites.find((c) => c.n && c.n === original);
    if (hit) {
      hit.chips.forEach(addChip);
      hit.flags.forEach(addFlag);
      return { chips, flags, residue: "", via: "composite" };
    }

    let rest = original;
    for (const p of fieldPhrases) {
      if (!p.n) continue;
      let i = indexWhole(rest, p.n);
      if (i < 0) continue;
      addFlag(p.code);
      while (i >= 0) {
        rest = `${rest.slice(0, i)} ${rest.slice(i + p.n.length)}`.replace(/\s+/g, " ").trim();
        i = indexWhole(rest, p.n);
      }
      if (p.code === "BATH_SEQUENCE") {
        addChip("ZONE-SITZ");
        addChip("ZONE-FULL-BODY");
      }
      if (p.code === "APPLICATION_CUT") {
        if (/corab|noski/.test(p.n) && implies.SOCK) addChip(implies.SOCK);
        if (/elcek/.test(p.n) && implies.GLOVE) addChip(implies.GLOVE);
      }
    }
    rest = rest.replace(/\s+/g, " ").trim();

    let guard = 0;
    while (rest && guard++ < 20) {
      let found: { n: string; code: string } | null = null;
      for (const a of aliases) {
        if (!a.n || indexWhole(rest, a.n) < 0) continue;
        if (a.code === "ZONE-HEAD" && a.n === "bas" && /\bbarmaq/.test(rest)) continue;
        found = a;
        break;
      }
      if (!found) break;
      addChip(found.code);
      const i = indexWhole(rest, found.n);
      rest = `${rest.slice(0, i)} ${rest.slice(i + found.n.length)}`.replace(/\s+/g, " ").trim();
    }

    for (const s of stop) {
      let i: number;
      while ((i = indexWhole(rest, s)) >= 0) {
        rest = `${rest.slice(0, i)} ${rest.slice(i + s.length)}`.replace(/\s+/g, " ").trim();
      }
    }

    rest = resolveButun(rest, chips, addChip, opts && opts.procedureName);

    return { chips, flags, residue: rest, via: "greedy" };
  }

  return { match };
}

/** First import fills note from WO nahiye; never wipe an existing note. */
export function fillImportedNote(existingNote: string | null | undefined, nahiye: string | null | undefined): string | null {
  const have = (existingNote ?? "").trim();
  if (have) return existingNote ?? have;
  const incoming = (nahiye ?? "").trim();
  return incoming || null;
}

export type EmptyNahiyeKind =
  | "no-surface-site"
  | "site-in-name"
  | "site-in-name-missing-nose"
  | "fill-ambiguous"
  | "needs-nahiye"
  | "unknown";

export function overlayZoneAliases(
  cat: NahiyeMatchCatalog,
  sites: Array<{ code: string; aliases: Array<{ alias: string }> }>,
): NahiyeMatchCatalog {
  if (!sites.length) return cat;
  const jsonByCode = new Map((cat.zones ?? []).map((z) => [z.code, z]));
  const seen = new Set<string>();
  const zones: NonNullable<NahiyeMatchCatalog["zones"]> = [];
  for (const s of sites) {
    seen.add(s.code);
    const merged: string[] = [];
    const have = new Set<string>();
    for (const a of [...(jsonByCode.get(s.code)?.woAliases ?? []), ...s.aliases.map((x) => x.alias)]) {
      const k = fold(a);
      if (!k || have.has(k)) continue;
      have.add(k);
      merged.push(a);
    }
    zones.push({ code: s.code, woAliases: merged });
  }
  for (const z of cat.zones ?? []) {
    if (!seen.has(z.code)) zones.push(z);
  }
  return { ...cat, zones };
}

export function classifyEmptyNahiye(procedureName: string): {
  kind: EmptyNahiyeKind;
  defaults: string[];
} {
  const n = fold(procedureName || "");
  if (!n) return { kind: "unknown", defaults: [] };
  if (/inqalyasiya|hidrokolon|uroloji|ozonterapiya|fito.?terapiya|karboksi/.test(n)) {
    return { kind: "no-surface-site", defaults: [] };
  }
  if (/turunda qulaq|trunda qulaq/.test(n)) return { kind: "site-in-name", defaults: ["ZONE-EAR"] };
  if (/(trunda|turunda)/.test(n) && /burun/.test(n)) {
    return { kind: "site-in-name-missing-nose", defaults: [] };
  }
  if (/turunda|trunda/.test(n)) return { kind: "site-in-name", defaults: ["ZONE-EAR"] };
  if (/4 kamera/.test(n)) return { kind: "site-in-name", defaults: ["ZONE-FOUR-CHAMBER"] };
  if (/parafin.*butun|butun beden/.test(n)) {
    return { kind: "site-in-name", defaults: ["ZONE-FULL-BODY"] };
  }
  if (/parafin/.test(n) && /asagi/.test(n)) {
    return { kind: "site-in-name", defaults: ["ZONE-LOWER-LIMB"] };
  }
  if (/parafin/.test(n) && /yuxari/.test(n)) {
    return { kind: "site-in-name", defaults: ["ZONE-UPPER-LIMB"] };
  }
  if (/parafin/.test(n) && (/kurek/.test(n) || /boyun/.test(n))) {
    return { kind: "site-in-name", defaults: ["ZONE-COLLAR"] };
  }
  if (/tam beden naftalan/.test(n)) {
    return { kind: "site-in-name", defaults: ["ZONE-FULL-BODY"] };
  }
  if (/yod.?brom/.test(n)) return { kind: "site-in-name", defaults: ["ZONE-FULL-BODY"] };
  if (/hidromasaj/.test(n)) return { kind: "site-in-name", defaults: ["ZONE-FULL-BODY"] };
  if (/massaj 30/.test(n)) return { kind: "site-in-name", defaults: ["ZONE-FULL-BODY"] };
  if (/^ufb\b|ufb terapiya/.test(n)) return { kind: "site-in-name", defaults: ["ZONE-FULL-BODY"] };
  if (/bukme/.test(n)) return { kind: "site-in-name", defaults: ["ZONE-FULL-BODY"] };
  if (/limfodrenaj/.test(n)) return { kind: "site-in-name", defaults: ["ZONE-LOWER-LIMB"] };
  if (/naftalan vannasi|isiq vann/.test(n)) {
    return { kind: "fill-ambiguous", defaults: [] };
  }
  return { kind: "needs-nahiye", defaults: [] };
}
