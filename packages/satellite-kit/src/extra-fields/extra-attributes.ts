/**
 * Tenant extra-attribute validation — ADR extensibility-forms-print-reports.md
 * Values never participate in GL posting. Unknown keys are rejected.
 */

import type { CatalogFieldKind } from "../ui/catalog-field-kind";

export const EXTRA_ENTITY_FINANCE_INVOICE = "FINANCE_INVOICE" as const;

export type ExtraEntityType = typeof EXTRA_ENTITY_FINANCE_INVOICE;

export type ExtraFieldValueKind =
  | "TEXT"
  | "NUMBER"
  | "DATE"
  | "BOOLEAN"
  | "SELECT";

export type ExtraFieldOption = { value: string };

export type ExtraFieldDefinitionView = {
  key: string;
  valueKind: ExtraFieldValueKind;
  catalogFieldKind: CatalogFieldKind;
  required: boolean;
  active: boolean;
  options?: ExtraFieldOption[];
};

export type ExtraAttributesIssueCode =
  | "EXTRA_FIELD_UNKNOWN_KEY"
  | "EXTRA_FIELD_TYPE"
  | "EXTRA_FIELD_REQUIRED"
  | "EXTRA_FIELD_KEY";

export type ExtraAttributesIssue = {
  code: ExtraAttributesIssueCode;
  keys: string[];
  message: string;
};

export type ExtraAttributesResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; issue: ExtraAttributesIssue };

export const EXTRA_FIELD_KEY_RE = /^[a-z][a-z0-9_]{1,47}$/;

export function defaultCatalogFieldKind(
  valueKind: ExtraFieldValueKind,
): CatalogFieldKind {
  return valueKind === "SELECT" ? "CLOSED_SMALL" : "FREE_TEXT";
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function issue(
  code: ExtraAttributesIssueCode,
  keys: string[],
  message: string,
): ExtraAttributesResult {
  return { ok: false, issue: { code, keys, message } };
}

function parseDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== mo - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return v;
}

function parseNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseBoolean(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return null;
}

/**
 * Persist only active keys. Retired keys in the payload are dropped.
 * Keys that were never defined are rejected (400).
 */
export function normalizeExtraAttributes(
  defs: ExtraFieldDefinitionView[],
  raw: unknown,
): ExtraAttributesResult {
  if (raw == null) {
    raw = {};
  }
  if (!isPlainObject(raw)) {
    return issue("EXTRA_FIELD_TYPE", [], "extraAttributes must be an object");
  }

  const active = defs.filter((d) => d.active);
  const known = new Set(defs.map((d) => d.key));
  const unknown = Object.keys(raw).filter((k) => !known.has(k));
  if (unknown.length > 0) {
    return issue(
      "EXTRA_FIELD_UNKNOWN_KEY",
      unknown,
      `Unknown extra field(s): ${unknown.join(", ")}`,
    );
  }

  const out: Record<string, unknown> = {};
  const missing: string[] = [];
  const typeKeys: string[] = [];

  for (const def of active) {
    const present = Object.prototype.hasOwnProperty.call(raw, def.key);
    const val = present ? raw[def.key] : undefined;
    const empty =
      val === undefined ||
      val === null ||
      (typeof val === "string" && val.trim() === "");

    if (empty) {
      if (def.required) missing.push(def.key);
      continue;
    }

    if (def.valueKind === "TEXT") {
      if (typeof val !== "string") {
        typeKeys.push(def.key);
        continue;
      }
      const trimmed = val.trim();
      if (trimmed.length === 0) {
        if (def.required) missing.push(def.key);
        continue;
      }
      if (trimmed.length > 500) {
        typeKeys.push(def.key);
        continue;
      }
      out[def.key] = trimmed;
      continue;
    }
    if (def.valueKind === "NUMBER") {
      const n = parseNumber(val);
      if (n === null) {
        typeKeys.push(def.key);
        continue;
      }
      out[def.key] = n;
      continue;
    }
    if (def.valueKind === "DATE") {
      const d = parseDate(val);
      if (d === null) {
        typeKeys.push(def.key);
        continue;
      }
      out[def.key] = d;
      continue;
    }
    if (def.valueKind === "BOOLEAN") {
      const b = parseBoolean(val);
      if (b === null) {
        typeKeys.push(def.key);
        continue;
      }
      out[def.key] = b;
      continue;
    }
    if (def.valueKind === "SELECT") {
      const s = typeof val === "string" ? val : null;
      const allowed = (def.options ?? []).map((o) => o.value);
      if (!s || !allowed.includes(s)) {
        typeKeys.push(def.key);
        continue;
      }
      out[def.key] = s;
    }
  }

  if (missing.length > 0) {
    return issue(
      "EXTRA_FIELD_REQUIRED",
      missing,
      `Required extra field(s): ${missing.join(", ")}`,
    );
  }
  if (typeKeys.length > 0) {
    return issue(
      "EXTRA_FIELD_TYPE",
      typeKeys,
      `Invalid extra field type(s): ${typeKeys.join(", ")}`,
    );
  }
  return { ok: true, value: out };
}

export function assertExtraFieldKey(key: string): ExtraAttributesResult | null {
  if (!EXTRA_FIELD_KEY_RE.test(key)) {
    return issue(
      "EXTRA_FIELD_KEY",
      [key],
      "Extra field key must be snake_case starting with a letter",
    );
  }
  return null;
}
