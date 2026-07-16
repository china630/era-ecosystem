/**
 * Shared e-taxes donor name → search query helpers.
 */

// Legal-form tail only — do NOT strip "audit" (part of auditor trade names).
export const LEGAL_SUFFIX_RE =
  /məhdud məsuliyyətli cəmiyyəti|məhdud mesuliyyetli cemiyyeti|qapalı səhmdar cəmiyyəti|qapalı səhmdar cemiyyeti|qsc|mmc|ltd|llc/gi;

const GENERIC_STOPWORDS = new Set([
  "plus",
  "audit",
  "auditi",
  "travel",
  "turizm",
  "tour",
  "hotel",
  "hotels",
  "klinik",
  "clinic",
  "medical",
  "mmc",
  "group",
  "center",
  "centre",
  "merkez",
  "merkezi",
  "mərkəz",
  "mərkəzi",
  "services",
  "service",
  "consulting",
  "consult",
  "company",
  "finance",
  "finans",
  "financial",
  "general",
  "international",
  "beynəlxalq",
  "beynelxalq",
  "baki",
  "baku",
  "account",
  "active",
  "economic",
  "control",
  "support",
  "reporting",
  "co",
  "and",
  "the",
  "for",
  "sanatoriya",
  "sanatoriyasi",
  "otel",
  "resort",
  "spa",
  "klinika",
  "hospital",
  "müalicə",
  "mualice",
  "net",
  // retail / plaza brand noise — wastes alt rounds, causes weak matches
  "kids",
  "store",
  "stores",
  "beauty",
  "accessories",
  "accessory",
  "cafe",
  "coffee",
  "tea",
  "home",
  "plaza",
  "mall",
  "studio",
  "bookstore",
  "pharm",
  "pharma",
  "pharmacy",
  "diner",
  "restaurant",
  "bar",
  "shop",
  "shops",
  "art",
  "brand",
  "brands",
  "fashion",
  "wear",
  "house",
  "life",
  "world",
  "park",
  "point",
  "city",
  "burger",
  "pizza",
  "grill",
  "market",
  "express",
  "premium",
  "official",
  "holding",
  "construction",
  "telecom",
  "therapy",
  "solutions",
  "consulting",
  "zone",
]);

export const ETAXES_LOCALE = "az-AZ";

export function cleanForSearch(name) {
  return (name ?? "")
    .replace(/[\u201C\u201D\u00AB\u00BB\u201E\u201F"″‟]/g, "")
    .replace(/\|/g, " ")
    .replace(/&/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** FIO-like strings are poor legalEntity queries (alt-round noise). */
export function isPersonLikeQuery(q) {
  const s = String(q ?? "");
  if (/\b(OĞLU|OGLU|QIZI|QIZIYI)\b/i.test(s)) return true;
  // 3+ Capitalized tokens with hyphens: SALMANOV-ZABIT-SAKIT-OGLU style
  const parts = s.split(/[\s\-]+/).filter(Boolean);
  if (parts.length >= 3 && parts.every((p) => /^[\p{L}]{3,}$/u.test(p))) {
    const upperish = parts.filter((p) => p === p.toLocaleUpperCase(ETAXES_LOCALE)).length;
    if (upperish >= parts.length - 1) return true;
  }
  return false;
}

/** Quoted trade name, e.g. "AKK-NET AUDİT" from full legal title. */
export function extractBrandName(rawName) {
  const m = String(rawName ?? "").match(/["«]([^"»]+)["»]/);
  return m ? cleanForSearch(m[1]) : "";
}

/** Text before legal-form suffix (keeps AUDİT in auditor names). */
export function extractTradeName(rawName) {
  const brand = extractBrandName(rawName);
  if (brand) return brand;
  let n = cleanForSearch(rawName);
  const cut = n.search(
    /\bməhdud\b|\bqapalı\b|\bmmc\b|\bltd\b|\bllc\b|\bqsc\b/i,
  );
  if (cut > 0) n = n.slice(0, cut);
  return n.replace(/\s+/g, " ").trim();
}

/** DVX UI searches in Azerbaijani uppercase: i→İ, ı→I (not default toUpperCase). */
export function toEtaxesSearchQuery(q) {
  return String(q ?? "").trim().toLocaleUpperCase(ETAXES_LOCALE);
}

/**
 * ASCII-I variant (İ→I). Live A/B 2026-07-16: 0 wins vs az-İ on 404 —
 * DVX treats them equivalently. Kept for experiments only.
 */
export function toEtaxesAsciiIQuery(q) {
  return toEtaxesSearchQuery(q).replace(/\u0130/g, "I");
}

/** Stable ASCII-folded key for cache dedup (ati / ATİ / ATI → ati). */
export function cacheKeyForQuery(q) {
  return normToken(String(q ?? "").trim());
}

export function cacheFileSlug(q) {
  return cacheKeyForQuery(q).replace(/[^a-z0-9_-]/g, "_");
}

export function normToken(t) {
  return String(t ?? "")
    .toLocaleLowerCase(ETAXES_LOCALE)
    .replace(/[ə]/g, "e")
    .replace(/[ı]/g, "i")
    .replace(/[ö]/g, "o")
    .replace(/[ü]/g, "u")
    .replace(/[ç]/g, "c")
    .replace(/[ş]/g, "s")
    .replace(/[ğ]/g, "g");
}

export function isGenericToken(token) {
  const n = normToken(token);
  if (n.length < 3) return true;
  if (GENERIC_STOPWORDS.has(n)) return true;
  if (/^(audit|travel|hotel|klinik|finans|finance|mmc)$/.test(n)) return true;
  return false;
}

export function tokenizeName(rawName) {
  let n = extractTradeName(rawName).replace(LEGAL_SUFFIX_RE, " ").trim();
  n = n.replace(/\s+/g, " ").trim();
  return n
    .split(/[\s\-\/|+,]+/)
    .map((p) => p.replace(/[^0-9A-Za-zƏəİıÖöÜüÇçŞşĞğ]/g, ""))
    .filter((p) => p.length >= 3 && /[A-Za-zƏəİıÖöÜüÇçŞşĞğ]/.test(p))
    .filter((p) => !/^\d+$/.test(p));
}

export function deriveSearchQueries(rawName) {
  const trade = extractTradeName(rawName);
  const parts = tokenizeName(rawName);
  const queries = [];
  const seen = new Set();

  const add = (q) => {
    let trimmed = String(q ?? "").trim();
    trimmed = cleanForSearch(trimmed);
    if (trimmed.length < 3 || !/[A-Za-zƏəİıÖöÜüÇçŞşĞğ]/.test(trimmed)) return;
    if (isPersonLikeQuery(trimmed)) return;
    if (/[|]/.test(trimmed)) return;
    const k = normToken(trimmed);
    if (!k || seen.has(k)) return;
    seen.add(k);
    queries.push(trimmed);
  };

  // 1) Full trade name — matches manual e-taxes UI search (e.g. AKK-NET AUDİT).
  if (trade) {
    add(trade.slice(0, 48));
    add(trade.replace(/-/g, " ").replace(/\s+/g, " ").trim().slice(0, 48));
    // Hyphenate only short trade names (long hyphen-soup burns alt rounds).
    if (trade.length <= 28) {
      const hyphenated = trade.replace(/\s+/g, "-");
      if (hyphenated !== trade) add(hyphenated.slice(0, 48));
    }
  }

  const distinctive = parts.filter((p) => !isGenericToken(p));
  const scored = [...parts]
    .map((p, i) => ({
      p,
      score: (isGenericToken(p) ? 0 : p.length * 2) + (i === 0 ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score);

  for (const { p } of scored) {
    if (!isGenericToken(p)) add(p);
  }

  if (distinctive.length >= 2) {
    add(`${distinctive[0]} ${distinctive[1]}`.slice(0, 48));
    if (`${distinctive[0]}-${distinctive[1]}`.length <= 28) {
      add(`${distinctive[0]}-${distinctive[1]}`.slice(0, 48));
    }
    if (distinctive.length >= 3) {
      add(`${distinctive[0]} ${distinctive[2]}`.slice(0, 48));
    }
  }

  // Compound hyphen tokens: AKK-NET → also AKK NET AUDİT when trade has more words.
  if (trade.includes("-") && trade.length <= 40) {
    const segs = trade.split(/\s+/).map((w) => w.replace(/-/g, " ")).join(" ");
    add(segs.slice(0, 48));
  }

  for (const p of parts) {
    if (!isGenericToken(p)) add(p);
  }

  if (!queries.length) {
    const fallback = cleanForSearch(rawName)
      .replace(LEGAL_SUFFIX_RE, " ")
      .replace(/[^0-9A-Za-zƏəİıÖöÜüÇçŞşĞğ\s\-]/g, "")
      .trim();
    if (fallback.length >= 3 && !isPersonLikeQuery(fallback)) add(fallback.slice(0, 48));
  }

  return queries.slice(0, 6);
}

export function deriveSearchQuery(rawName) {
  return deriveSearchQueries(rawName)[0] ?? "";
}

export function normalizeNameKey(s) {
  return cleanForSearch(s)
    .toLocaleLowerCase(ETAXES_LOCALE)
    .replace(/[ə]/g, "e")
    .replace(/[ı]/g, "i")
    .replace(/[ö]/g, "o")
    .replace(/[ü]/g, "u")
    .replace(/[ç]/g, "c")
    .replace(/[ş]/g, "s")
    .replace(/[ğ]/g, "g")
    .replace(/-/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

export function donorMatchesTaxpayer(donorName, donorLegalName, taxpayerName) {
  const donorKey = normalizeNameKey(donorName);
  const legalKey = normalizeNameKey(donorLegalName);
  const taxKey = normalizeNameKey(taxpayerName);
  if (!donorKey || !taxKey) return false;

  if (
    taxKey.includes(donorKey) ||
    donorKey.includes(taxKey) ||
    (legalKey && (taxKey.includes(legalKey) || legalKey.includes(taxKey)))
  ) {
    return true;
  }

  // Trade name without generic tail: "AKK-NET AUDİT" ↔ "AKK NET AUDİT" MMC.
  const tradeKey = normalizeNameKey(extractTradeName(donorLegalName || donorName));
  if (tradeKey.length >= 6 && taxKey.includes(tradeKey)) return true;

  return false;
}
