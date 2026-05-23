/** Retail vertical presets (single app — era-retail-pos). */
export type RetailPreset = "grocery" | "apparel" | "electronics" | "pharmacy";

export const RETAIL_PRESETS: RetailPreset[] = [
  "grocery",
  "apparel",
  "electronics",
  "pharmacy",
];

export function isRetailPreset(value: string): value is RetailPreset {
  return (RETAIL_PRESETS as string[]).includes(value);
}

export function presetLabel(preset: RetailPreset): string {
  const labels: Record<RetailPreset, string> = {
    grocery: "Grocery",
    apparel: "Apparel",
    electronics: "Electronics",
    pharmacy: "Pharmacy",
  };
  return labels[preset];
}
