import parsePhoneNumberFromString, {
  type CountryCode,
} from "libphonenumber-js";

/** ISO regions where national (non-+) numbers may be polished to E.164 in MVP. */
export const PERSON_PHONE_POLISH_REGIONS = ["AZ", "KZ", "RU", "TR"] as const;

export type PersonPhonePolishRegion = (typeof PERSON_PHONE_POLISH_REGIONS)[number];

export type NormalizePersonPhoneStatus =
  | "empty"
  | "unchanged"
  | "polished"
  | "needs_region"
  | "conflict"
  | "invalid";

export type NormalizePersonPhoneResult = {
  status: NormalizePersonPhoneStatus;
  /** Value for the field (E.164 when polished / already international, else trimmed original). */
  display: string;
  e164: string | null;
  /** i18n key fragment for hotel toast messages (`needs_region` | `conflict` | `invalid` | …). */
  reasonKey: string;
  detectedRegion?: string;
};

const POLISH_SET = new Set<string>(PERSON_PHONE_POLISH_REGIONS);

function normalizeIso(raw: string | null | undefined): string {
  return String(raw ?? "")
    .trim()
    .toUpperCase();
}

function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, "");
}

function isPolishRegion(iso: string): iso is PersonPhonePolishRegion {
  return POLISH_SET.has(iso);
}

/**
 * True when the input already carries an international calling code
 * (`+…` or a digit string that parses as a valid E.164 number).
 * International numbers are never rewritten from nationality.
 */
function tryParseInternational(raw: string): {
  e164: string;
  region: string | undefined;
} | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("+")) {
    const parsed = parsePhoneNumberFromString(trimmed);
    if (parsed?.isValid()) {
      return {
        e164: parsed.format("E.164"),
        region: parsed.country,
      };
    }
    return null;
  }

  const digits = digitsOnly(trimmed);
  if (digits.length < 8) return null;

  const asPlus = parsePhoneNumberFromString(`+${digits}`);
  if (asPlus?.isValid()) {
    return {
      e164: asPlus.format("E.164"),
      region: asPlus.country,
    };
  }
  return null;
}

/**
 * Normalize a person contact phone for ops cache / guest card.
 * Region comes from citizenship ISO on the same card — never invents +994 without nationality.
 */
export function normalizePersonPhone(input: {
  raw: string | null | undefined;
  nationalityIso: string | null | undefined;
}): NormalizePersonPhoneResult {
  const raw = String(input.raw ?? "");
  const trimmed = raw.trim();
  const nationality = normalizeIso(input.nationalityIso);

  if (!trimmed) {
    return {
      status: "empty",
      display: "",
      e164: null,
      reasonKey: "empty",
    };
  }

  const intl = tryParseInternational(trimmed);
  if (intl) {
    const detectedRegion = intl.region;
    const display = intl.e164;
    if (
      nationality &&
      detectedRegion &&
      detectedRegion !== nationality
    ) {
      // International wins: never rewrite; keep trimmed input (toast only).
      return {
        status: "conflict",
        display: trimmed,
        e164: display,
        reasonKey: "conflict",
        detectedRegion,
      };
    }
    // Prefer E.164 display when input was digits-only calling-code form (994…).
    if (display !== trimmed) {
      return {
        status: "polished",
        display,
        e164: display,
        reasonKey: "polished",
        detectedRegion,
      };
    }
    return {
      status: "unchanged",
      display,
      e164: display,
      reasonKey: "unchanged",
      detectedRegion,
    };
  }

  if (!nationality || !isPolishRegion(nationality)) {
    return {
      status: "needs_region",
      display: trimmed,
      e164: null,
      reasonKey: "needs_region",
    };
  }

  const parsed = parsePhoneNumberFromString(trimmed, nationality as CountryCode);
  if (!parsed?.isValid()) {
    return {
      status: "invalid",
      display: trimmed,
      e164: null,
      reasonKey: "invalid",
    };
  }

  const e164 = parsed.format("E.164");
  const detectedRegion = parsed.country;
  if (e164 === trimmed) {
    return {
      status: "unchanged",
      display: e164,
      e164,
      reasonKey: "unchanged",
      detectedRegion,
    };
  }
  return {
    status: "polished",
    display: e164,
    e164,
    reasonKey: "polished",
    detectedRegion,
  };
}

/** Digits of E.164 for dedup keys; falls back to last 9 national digits when normalize cannot. */
export function personPhoneDedupDigits(input: {
  raw: string | null | undefined;
  nationalityIso: string | null | undefined;
}): string {
  const result = normalizePersonPhone(input);
  if (result.e164) {
    return digitsOnly(result.e164);
  }
  const digits = digitsOnly(String(input.raw ?? ""));
  if (digits.length >= 9) return digits.slice(-9);
  return digits;
}
