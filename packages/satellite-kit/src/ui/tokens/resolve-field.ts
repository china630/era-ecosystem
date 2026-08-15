/**
 * Field resolver - maps (elementType, dataType, context) to width/align/format.
 *
 * Automation layer on top of 3-tier tokens: screens declare a dataType once;
 * resolveField decides preset, alignment, inputMode, and recommended filter control.
 *
 * Spec: DESIGN.md section Three-tier design tokens; ADR docs/adr/era-design-tokens-3tier.md
 */

/** Semantic data kinds for form fields, table cells, and filters. */
export type FieldDataType =
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
  | "textarea"
  | "enum"
  | "boolean";

/** Where the control is rendered. */
export type FieldElementType =
  | "field"
  | "label"
  | "tableCell"
  | "filter"
  | "modalFooter"
  | "button";

/** Layout density / surface. */
export type FieldContext = "modal" | "page" | "row" | "listFilter" | "table";

export type FieldAlign = "left" | "right" | "center";

export type FilterControlKind =
  | "text"
  | "select"
  | "dateRange"
  | "amountRange"
  | "toggle"
  | "none";

export type ResolvedField = {
  /** Width preset key - matches Field / FieldSelect preset prop. */
  preset: Exclude<FieldDataType, "enum" | "boolean"> | "shortText" | "select";
  /** Tailwind width class fragment. */
  widthClass: string;
  align: FieldAlign;
  inputMode?: "numeric" | "decimal" | "tel" | "text";
  format?: "azn" | "isoDate" | "displayDate" | "plain";
  filterControl: FilterControlKind;
  tabularNums: boolean;
};

const WIDTH: Record<string, string> = {
  count: "w-[6ch] max-w-full",
  time: "w-[7ch] max-w-full",
  date: "w-[12ch] min-w-[10.5rem] max-w-full",
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
};

type DataRules = {
  preset: ResolvedField["preset"];
  align: FieldAlign;
  inputMode?: ResolvedField["inputMode"];
  format?: ResolvedField["format"];
  filterControl: FilterControlKind;
  tabularNums: boolean;
};

const DATA_RULES: Record<FieldDataType, DataRules> = {
  count: { preset: "count", align: "right", inputMode: "numeric", filterControl: "text", tabularNums: true },
  time: { preset: "time", align: "left", filterControl: "text", tabularNums: false },
  date: { preset: "date", align: "right", format: "displayDate", filterControl: "dateRange", tabularNums: false },
  amount: { preset: "amount", align: "right", inputMode: "decimal", format: "azn", filterControl: "amountRange", tabularNums: true },
  voen: { preset: "voen", align: "left", inputMode: "numeric", filterControl: "text", tabularNums: true },
  fin: { preset: "fin", align: "left", filterControl: "text", tabularNums: true },
  phone: { preset: "phone", align: "left", inputMode: "tel", filterControl: "text", tabularNums: false },
  code: { preset: "code", align: "left", filterControl: "text", tabularNums: false },
  shortText: { preset: "shortText", align: "left", filterControl: "text", tabularNums: false },
  longText: { preset: "longText", align: "left", filterControl: "text", tabularNums: false },
  select: { preset: "select", align: "left", filterControl: "select", tabularNums: false },
  selectWide: { preset: "selectWide", align: "left", filterControl: "select", tabularNums: false },
  textarea: { preset: "textarea", align: "left", filterControl: "none", tabularNums: false },
  enum: { preset: "select", align: "center", filterControl: "select", tabularNums: false },
  boolean: { preset: "select", align: "center", filterControl: "toggle", tabularNums: false },
};

/**
 * Resolve presentation for a control / cell / filter from data type.
 */
export function resolveField(
  dataType: FieldDataType,
  _elementType: FieldElementType = "field",
  _context: FieldContext = "modal",
): ResolvedField {
  const rules = DATA_RULES[dataType];
  const widthClass = WIDTH[rules.preset] ?? WIDTH.shortText;
  return {
    preset: rules.preset,
    widthClass,
    align: rules.align,
    inputMode: rules.inputMode,
    format: rules.format,
    filterControl: rules.filterControl,
    tabularNums: rules.tabularNums,
  };
}

/** Tailwind text-align class for table cells. */
export function cellAlignClass(align: FieldAlign): string {
  if (align === "right") return "text-right";
  if (align === "center") return "text-center";
  return "text-left";
}
