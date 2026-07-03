/**
 * Semantic field width presets — DESIGN.md § Field width taxonomy.
 * Use via Field / FieldSelect / FieldTextarea (preset prop required).
 */
export const FIELD_WIDTH = {
  count: "w-[6ch] max-w-full",
  time: "w-[7ch] max-w-full",
  date: "w-[10ch] max-w-full",
  amount: "w-[12ch] max-w-full text-right tabular-nums",
  voen: "w-[11ch] min-w-[9.5rem] max-w-full tabular-nums",
  fin: "w-[9ch] max-w-full tabular-nums",
  phone: "w-[13ch] max-w-full",
  code: "w-[14ch] max-w-full",
  shortText: "w-[24ch] max-w-full",
  longText: "w-full",
  select: "w-[20ch] max-w-full",
  selectWide: "w-full",
  textarea: "w-full",
} as const;

export type FieldWidthPreset = keyof typeof FIELD_WIDTH;

export function fieldWidthClass(preset: FieldWidthPreset): string {
  return FIELD_WIDTH[preset];
}
