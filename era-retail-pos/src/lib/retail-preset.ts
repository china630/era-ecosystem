/** Retail vertical presets (single app — era-retail-pos). */
export type RetailPreset = "grocery" | "apparel" | "electronics" | "pharmacy";

export const RETAIL_PRESETS: RetailPreset[] = [
  "grocery",
  "apparel",
  "electronics",
  "pharmacy",
];

export interface RetailPresetConfig {
  code: RetailPreset;
  label: string;
  lineFields: string[];
  supportsWeighted: boolean;
  requiresVariant: boolean;
  requiresSerial: boolean;
  otcOnly: boolean;
  requiresRxGate: boolean;
}

export const RETAIL_PRESET_CONFIG: Record<RetailPreset, RetailPresetConfig> = {
  grocery: {
    code: "grocery",
    label: "Grocery",
    lineFields: ["plu", "barcode", "qty", "unitPrice", "isWeighted"],
    supportsWeighted: true,
    requiresVariant: false,
    requiresSerial: false,
    otcOnly: false,
    requiresRxGate: false,
  },
  apparel: {
    code: "apparel",
    label: "Apparel",
    lineFields: ["sku", "size", "color", "qty", "unitPrice"],
    supportsWeighted: false,
    requiresVariant: true,
    requiresSerial: false,
    otcOnly: false,
    requiresRxGate: false,
  },
  electronics: {
    code: "electronics",
    label: "Electronics",
    lineFields: ["sku", "serial", "qty", "unitPrice"],
    supportsWeighted: false,
    requiresVariant: false,
    requiresSerial: true,
    otcOnly: false,
    requiresRxGate: false,
  },
  pharmacy: {
    code: "pharmacy",
    label: "Pharmacy",
    lineFields: ["sku", "batch", "qty", "unitPrice", "rxRequired"],
    supportsWeighted: false,
    requiresVariant: false,
    requiresSerial: false,
    otcOnly: true,
    requiresRxGate: true,
  },
};

export function isRetailPreset(value: string): value is RetailPreset {
  return (RETAIL_PRESETS as string[]).includes(value);
}

export function presetLabel(preset: RetailPreset): string {
  return RETAIL_PRESET_CONFIG[preset].label;
}

export function getRetailPresetConfig(preset: RetailPreset): RetailPresetConfig {
  return RETAIL_PRESET_CONFIG[preset];
}

export function resolveOutletPreset(raw: string | null | undefined): RetailPreset {
  if (raw && isRetailPreset(raw)) return raw;
  return "grocery";
}
