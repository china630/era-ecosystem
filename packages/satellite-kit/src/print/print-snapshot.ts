/**
 * Print snapshot + placeholder whitelist — ADR extensibility-forms-print-reports.md W3.
 * Vendor HTML only; no SQL / no customer template eval.
 */

export const PRINT_BLANK_FINANCE_INVOICE_COMMERCIAL =
  "FINANCE_INVOICE_COMMERCIAL" as const;

export type PrintBlankId = typeof PRINT_BLANK_FINANCE_INVOICE_COMMERCIAL;

export type PrintLang = "az" | "ru" | "en";

export type PrintSnapshotScalar = string | number | boolean | null;

export type PrintSnapshotLine = Record<string, PrintSnapshotScalar>;

export type PrintSnapshot = {
  blankId: PrintBlankId | string;
  version: 1;
  lang: PrintLang;
  capturedAt: string;
  values: Record<string, PrintSnapshotScalar>;
  /** Bounded line repeater for {{#lines}} … {{/lines}}. */
  lines?: PrintSnapshotLine[];
};

export type PrintSnapshotIssueCode =
  | "PRINT_UNKNOWN_PLACEHOLDER"
  | "PRINT_TYPE"
  | "PRINT_NESTED_LOOP"
  | "PRINT_BLANK";

export type PrintSnapshotIssue = {
  code: PrintSnapshotIssueCode;
  keys: string[];
  message: string;
};

export type PrintInterpolateResult =
  | { ok: true; html: string }
  | { ok: false; issue: PrintSnapshotIssue };

function issue(
  code: PrintSnapshotIssueCode,
  keys: string[],
  message: string,
): PrintInterpolateResult {
  return { ok: false, issue: { code, keys, message } };
}

function escapeHtml(v: PrintSnapshotScalar): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;
const LINES_OPEN = "{{#lines}}";
const LINES_CLOSE = "{{/lines}}";
/** One bounded repeater — not a query language. */
export const PRINT_LINES_MAX = 500;

/**
 * Interpolate a vendor HTML template against a flat snapshot + one lines loop.
 * Unknown placeholders (not on whitelist) → error. Values missing from snapshot → empty string.
 */
export function interpolatePrintTemplate(
  template: string,
  snapshot: PrintSnapshot,
  whitelist: readonly string[],
  lineWhitelist: readonly string[] = [],
): PrintInterpolateResult {
  if (typeof template !== "string") {
    return issue("PRINT_TYPE", [], "Template must be a string");
  }
  if (!snapshot || typeof snapshot !== "object") {
    return issue("PRINT_TYPE", [], "Snapshot must be an object");
  }
  if (!snapshot.values || typeof snapshot.values !== "object") {
    return issue("PRINT_TYPE", ["values"], "Snapshot.values must be an object");
  }

  const allowed = new Set(whitelist);
  const allowedLine = new Set(lineWhitelist);

  const openCount = template.split(LINES_OPEN).length - 1;
  if (openCount > 1) {
    return issue(
      "PRINT_NESTED_LOOP",
      ["lines"],
      "Only one {{#lines}} block is allowed",
    );
  }

  const firstOpen = template.indexOf(LINES_OPEN);
  if (firstOpen >= 0) {
    const afterOpen = firstOpen + LINES_OPEN.length;
    const closeIdx = template.indexOf(LINES_CLOSE, afterOpen);
    if (closeIdx < 0) {
      return issue("PRINT_TYPE", ["lines"], "Unclosed {{#lines}} block");
    }
    const inner = template.slice(afterOpen, closeIdx);
    if (inner.includes(LINES_OPEN) || inner.includes(LINES_CLOSE)) {
      return issue(
        "PRINT_NESTED_LOOP",
        ["lines"],
        "Nested {{#lines}} loops are not allowed",
      );
    }
    const afterClose = template.slice(closeIdx + LINES_CLOSE.length);
    if (afterClose.includes(LINES_CLOSE)) {
      return issue("PRINT_TYPE", ["lines"], "Extra {{/lines}} is not allowed");
    }
  } else if (template.includes(LINES_CLOSE)) {
    return issue("PRINT_TYPE", ["lines"], "Orphan {{/lines}} is not allowed");
  }

  // Collect unknown placeholders outside loop first (whole template scan excluding loop body keys that use line.*)
  const unknown: string[] = [];
  function checkPlaceholders(chunk: string, set: Set<string>, prefixHint?: string) {
    let m: RegExpExecArray | null;
    const re = new RegExp(PLACEHOLDER_RE.source, "g");
    while ((m = re.exec(chunk)) !== null) {
      const key = m[1];
      if (!set.has(key)) {
        if (!unknown.includes(key)) unknown.push(key);
      }
      void prefixHint;
    }
  }

  // Split template into static + optional one lines block
  let working = template;
  if (firstOpen >= 0) {
    const afterOpen = firstOpen + LINES_OPEN.length;
    const closeIdx = template.indexOf(LINES_CLOSE, afterOpen);
    const before = template.slice(0, firstOpen);
    const loopBody = template.slice(afterOpen, closeIdx);
    const after = template.slice(closeIdx + LINES_CLOSE.length);

    checkPlaceholders(before, allowed);
    checkPlaceholders(after, allowed);
    checkPlaceholders(loopBody, allowedLine.size > 0 ? allowedLine : allowed);

    if (unknown.length > 0) {
      return issue(
        "PRINT_UNKNOWN_PLACEHOLDER",
        unknown,
        `Unknown placeholder(s): ${unknown.join(", ")}`,
      );
    }

    const rawLines = Array.isArray(snapshot.lines) ? snapshot.lines : [];
    const lines = rawLines.slice(0, PRINT_LINES_MAX);
    const renderedLines = lines
      .map((line) =>
        loopBody.replace(PLACEHOLDER_RE, (_all, key: string) => {
          const v = Object.prototype.hasOwnProperty.call(line, key)
            ? line[key]
            : null;
          return escapeHtml(v ?? null);
        }),
      )
      .join("");

    working = before + renderedLines + after;
  } else {
    checkPlaceholders(working, allowed);
    if (unknown.length > 0) {
      return issue(
        "PRINT_UNKNOWN_PLACEHOLDER",
        unknown,
        `Unknown placeholder(s): ${unknown.join(", ")}`,
      );
    }
  }

  const html = working.replace(PLACEHOLDER_RE, (_all, key: string) => {
    if (!allowed.has(key)) return "";
    const v = Object.prototype.hasOwnProperty.call(snapshot.values, key)
      ? snapshot.values[key]
      : null;
    return escapeHtml(v ?? null);
  });

  // Strip any leftover {{ (should not happen)
  const cleaned = html.replace(/\{\{[^}]*\}\}/g, "").replace(/\{\{/g, "");

  return { ok: true, html: cleaned };
}

/** Static whitelist keys for FINANCE_INVOICE_COMMERCIAL (extras added at capture). */
export const FINANCE_INVOICE_COMMERCIAL_BASE_WHITELIST = [
  "org.name",
  "org.taxId",
  "org.legalAddress",
  "org.logoUrl",
  "org.bankLine",
  "buyer.name",
  "buyer.taxId",
  "invoice.number",
  "invoice.status",
  "invoice.dueDate",
  "invoice.currency",
  "invoice.total",
  "invoice.paid",
  "invoice.remaining",
  "invoice.tradeContext",
  "label.title",
  "label.buyer",
  "label.due",
  "label.total",
  "label.paid",
  "label.remaining",
  "label.lines",
  "label.description",
  "label.qty",
  "label.unitPrice",
  "label.vat",
  "label.lineTotal",
  "label.extras",
  "label.voen",
] as const;

export const FINANCE_INVOICE_COMMERCIAL_LINE_WHITELIST = [
  "line.description",
  "line.sku",
  "line.qty",
  "line.unitPrice",
  "line.vatRate",
  "line.lineTotal",
] as const;

export function normalizePrintLang(raw: string | null | undefined): PrintLang {
  const v = (raw ?? "az").toLowerCase();
  if (v.startsWith("ru")) return "ru";
  if (v.startsWith("en")) return "en";
  return "az";
}
