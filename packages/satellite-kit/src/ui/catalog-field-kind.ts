/**
 * Managed-list UI control contract — ADR docs/adr/managed-lists-vs-enums.md
 *
 * Pick a CatalogFieldKind for every pick-list field; resolveCatalogControl()
 * chooses the control. Plain text is allowed only for FREE_TEXT.
 */

import type { FieldWidthPreset } from "./field-presets";

/** Semantic class of a managed / closed list field. */
export type CatalogFieldKind =
  /** ≤12 mutually exclusive — Select (or Radio when preferChips). */
  | "CLOSED_SMALL"
  /** 13–40 mutually exclusive — wider Select. */
  | "CLOSED_MEDIUM"
  /** Multi-value taxonomy — checkbox group / multi-select. */
  | "MULTI"
  /** ≥20 or searchable codes — Autocomplete / filterable combobox. */
  | "SEARCHABLE"
  /** Entity FK (account, SKU, guest, project) — Async Autocomplete. */
  | "ENTITY_REF"
  /** ≤4 ops actions on a hot path — radio / chips (pay tender, channel). */
  | "OPS_HOT"
  /** Explicit free text only (names, phones, document numbers). */
  | "FREE_TEXT";

export type CatalogControlType =
  | "select"
  | "selectWide"
  | "radioChips"
  | "multi"
  | "autocomplete"
  | "text";

export type ResolvedCatalogControl = {
  kind: CatalogFieldKind;
  control: CatalogControlType;
  /** Width preset for Field / FieldSelect shell. */
  widthPreset: FieldWidthPreset;
  /** When false, rendering Field/input type=text for this kind is a contract violation. */
  allowPlainText: boolean;
};

const TABLE: Record<CatalogFieldKind, Omit<ResolvedCatalogControl, "kind">> = {
  CLOSED_SMALL: {
    control: "select",
    widthPreset: "select",
    allowPlainText: false,
  },
  CLOSED_MEDIUM: {
    control: "selectWide",
    widthPreset: "selectWide",
    allowPlainText: false,
  },
  MULTI: {
    control: "multi",
    widthPreset: "selectWide",
    allowPlainText: false,
  },
  SEARCHABLE: {
    control: "autocomplete",
    widthPreset: "selectWide",
    allowPlainText: false,
  },
  ENTITY_REF: {
    control: "autocomplete",
    widthPreset: "selectWide",
    allowPlainText: false,
  },
  OPS_HOT: {
    control: "radioChips",
    widthPreset: "select",
    allowPlainText: false,
  },
  FREE_TEXT: {
    control: "text",
    widthPreset: "shortText",
    allowPlainText: true,
  },
};

/** Map list class → required UI control. */
export function resolveCatalogControl(kind: CatalogFieldKind): ResolvedCatalogControl {
  return { kind, ...TABLE[kind] };
}

/**
 * Heuristic for agents/devs: infer kind from option count + flags.
 * Prefer explicit kind at call sites; use this when migrating legacy consts.
 */
export function inferCatalogFieldKind(input: {
  optionCount: number;
  multi?: boolean;
  searchable?: boolean;
  entityRef?: boolean;
  opsHot?: boolean;
  freeText?: boolean;
}): CatalogFieldKind {
  if (input.freeText) return "FREE_TEXT";
  if (input.entityRef) return "ENTITY_REF";
  if (input.searchable) return "SEARCHABLE";
  if (input.multi) return "MULTI";
  if (input.opsHot && input.optionCount > 0 && input.optionCount <= 4) return "OPS_HOT";
  if (input.optionCount > 12) return "CLOSED_MEDIUM";
  return "CLOSED_SMALL";
}

/** Dev/test helper — throws if plain text is used for a non-FREE_TEXT kind. */
export function assertCatalogAllowsPlainText(kind: CatalogFieldKind): void {
  const resolved = resolveCatalogControl(kind);
  if (!resolved.allowPlainText) {
    throw new Error(
      `CatalogFieldKind ${kind} forbids plain text; use control=${resolved.control} via CatalogField`,
    );
  }
}
