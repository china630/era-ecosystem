/**
 * Pure helpers for CP-ORG-PROFILE-01 Finance→orch (then hotel/clinic) backfill.
 * Keep free of DB clients so unit tests stay light.
 */

export type BackfillCounters = {
  orgsSeen: number;
  filled: number;
  skippedExisting: number;
  skippedNoSource: number;
  skippedDataUrlLogo: number;
  skippedRelativeLogo: number;
  fieldsWritten: number;
};

export type ProfileSeed = {
  directorName?: string | null;
  logoUrl?: string | null;
  bankLine?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  legalAddress?: string | null;
  addressAz?: string | null;
  addressRu?: string | null;
  addressEn?: string | null;
};

export type ExistingProfileState = {
  hasProfile: boolean;
  directorName: string | null;
  logoUrl: string | null;
  bankLine: string | null;
  hasPhone: boolean;
  hasEmail: boolean;
  hasWebsite: boolean;
  hasLegalAddress: boolean;
};

export function emptyCounters(): BackfillCounters {
  return {
    orgsSeen: 0,
    filled: 0,
    skippedExisting: 0,
    skippedNoSource: 0,
    skippedDataUrlLogo: 0,
    skippedRelativeLogo: 0,
    fieldsWritten: 0,
  };
}

/** Accept only absolute http(s) URLs — never data: into orch. */
export function isHttpLogoUrl(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  try {
    const u = new URL(value.trim());
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export function isDataUrl(value: string | null | undefined): boolean {
  return Boolean(value?.trim().toLowerCase().startsWith("data:"));
}

export function isSameOriginFilePath(value: string | null | undefined): boolean {
  const t = value?.trim() ?? "";
  return t.startsWith("/") && !t.startsWith("//") && !t.includes("\\");
}

/**
 * Resolve Finance logo for orch SoR.
 * - http(s) absolute → keep
 * - data: → skip (clinic data-URLs)
 * - `/files/...` → prefix with financePublicBase when set; else skipRelative
 */
export function resolveLogoUrlForCp(
  raw: string | null | undefined,
  opts?: { financePublicBase?: string | null },
): {
  url?: string;
  skipDataUrl?: boolean;
  skipRelative?: boolean;
} {
  const t = trimOrNull(raw);
  if (!t) return {};
  if (isDataUrl(t)) return { skipDataUrl: true };
  if (isHttpLogoUrl(t)) return { url: t };
  if (isSameOriginFilePath(t)) {
    const base = trimOrNull(opts?.financePublicBase)?.replace(/\/$/, "");
    if (!base || !isHttpLogoUrl(base)) return { skipRelative: true };
    const abs = `${base}${t}`;
    return isHttpLogoUrl(abs) ? { url: abs } : { skipRelative: true };
  }
  return {};
}

/** Website: http(s) or bare host → https://host */
export function normalizeWebsiteUrl(
  value: string | null | undefined,
): string | null {
  const t = trimOrNull(value);
  if (!t || isDataUrl(t)) return null;
  if (isHttpLogoUrl(t)) return t;
  if (/^[a-z0-9.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(t)) {
    const withProto = `https://${t}`;
    return isHttpLogoUrl(withProto) ? withProto : null;
  }
  return null;
}

export function formatBankLine(account: {
  bankName: string | null;
  accountNumber: string | null;
  currency: string | null;
  iban: string | null;
  swift: string | null;
} | null): string | null {
  if (!account) return null;
  const parts = [
    account.bankName,
    account.accountNumber,
    account.currency,
    account.iban ? `IBAN ${account.iban}` : null,
    account.swift ? `SWIFT ${account.swift}` : null,
  ].filter(Boolean);
  const line = parts.join(" · ").trim();
  return line || null;
}

export function trimOrNull(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

/**
 * Merge seed into existing profile: only fill empty slots.
 * Returns patch + contact/address creates (never overwrites).
 *
 * `seed.logoUrl` must already be absolute http(s) or a data:/relative marker
 * that resolveLogoUrlForCp classified — pass pre-resolved URL in seed, and set
 * logoSkip* when the raw value could not be written.
 */
export function planProfileFill(
  existing: ExistingProfileState,
  seed: ProfileSeed,
  logoMeta?: { skipDataUrl?: boolean; skipRelative?: boolean },
): {
  profilePatch: {
    directorName?: string;
    logoUrl?: string;
    bankLine?: string;
  };
  createPhone?: string;
  createEmail?: string;
  createWebsite?: string;
  createLegal?: {
    line1: string;
    lineAz?: string | null;
    lineRu?: string | null;
    lineEn?: string | null;
  };
  skipDataUrlLogo: boolean;
  skipRelativeLogo: boolean;
  hasAnyWrite: boolean;
  hasAnySeed: boolean;
  /** True when seed had non-logo payload (phone/address/…), even if already present. */
  hasNonLogoSeed: boolean;
} {
  const profilePatch: {
    directorName?: string;
    logoUrl?: string;
    bankLine?: string;
  } = {};

  const skipDataUrlLogo = Boolean(logoMeta?.skipDataUrl);
  const skipRelativeLogo = Boolean(logoMeta?.skipRelative);

  const director = trimOrNull(seed.directorName);
  if (!existing.directorName && director) profilePatch.directorName = director;

  const logo = trimOrNull(seed.logoUrl);
  if (!existing.logoUrl && logo && isHttpLogoUrl(logo)) {
    profilePatch.logoUrl = logo;
  }

  const bank = trimOrNull(seed.bankLine);
  if (!existing.bankLine && bank) profilePatch.bankLine = bank;

  const phone = trimOrNull(seed.phone);
  const createPhone = !existing.hasPhone && phone ? phone : undefined;
  const email = trimOrNull(seed.email);
  const createEmail = !existing.hasEmail && email ? email : undefined;
  const website = normalizeWebsiteUrl(seed.website);
  const createWebsite =
    !existing.hasWebsite && website ? website : undefined;

  const line1 =
    trimOrNull(seed.legalAddress) ||
    trimOrNull(seed.addressAz) ||
    trimOrNull(seed.addressRu) ||
    trimOrNull(seed.addressEn);
  const createLegal =
    !existing.hasLegalAddress && line1
      ? {
          line1,
          lineAz: trimOrNull(seed.addressAz),
          lineRu: trimOrNull(seed.addressRu),
          lineEn: trimOrNull(seed.addressEn),
        }
      : undefined;

  const hasAnyWrite =
    Object.keys(profilePatch).length > 0 ||
    Boolean(createPhone || createEmail || createWebsite || createLegal);

  const hasNonLogoSeed = Boolean(
    director ||
      bank ||
      phone ||
      email ||
      trimOrNull(seed.website) ||
      line1 ||
      trimOrNull(seed.addressAz) ||
      trimOrNull(seed.addressRu) ||
      trimOrNull(seed.addressEn),
  );

  const hasAnySeed = Boolean(
    hasNonLogoSeed || logo || skipDataUrlLogo || skipRelativeLogo,
  );

  return {
    profilePatch,
    createPhone,
    createEmail,
    createWebsite,
    createLegal,
    skipDataUrlLogo,
    skipRelativeLogo,
    hasAnyWrite,
    hasAnySeed,
    hasNonLogoSeed,
  };
}
