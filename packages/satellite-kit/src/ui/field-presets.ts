/**
 * Semantic field width presets - DESIGN.md Field width taxonomy.
 * Backed by resolveField (3-tier token automation). Use via Field / FieldSelect
 * (preset prop required).
 */

import { resolveField, type FieldDataType } from "./tokens/resolve-field";

export type FieldWidthPreset =
  | "count"
  | "time"
  | "date"
  | "amount"
  | "voen"
  | "fin"
  | "phone"
  | "code"
  | "shortText"
  | "longText"
  | "select"
  | "selectWide"
  | "textarea";

const PRESET_KEYS: FieldWidthPreset[] = [
  "count",
  "time",
  "date",
  "amount",
  "voen",
  "fin",
  "phone",
  "code",
  "shortText",
  "longText",
  "select",
  "selectWide",
  "textarea",
];

function widthFor(preset: FieldWidthPreset): string {
  return resolveField(preset as FieldDataType).widthClass;
}

/** @deprecated Prefer resolveField(dataType).widthClass - kept for Field* APIs. */
export const FIELD_WIDTH: Record<FieldWidthPreset, string> = Object.fromEntries(
  PRESET_KEYS.map((k) => [k, widthFor(k)]),
) as Record<FieldWidthPreset, string>;

export function fieldWidthClass(preset: FieldWidthPreset): string {
  return FIELD_WIDTH[preset];
}
