/**
 * Edition, preset, and hotel mode are three separate fields on `FnbOrgProfile`.
 * Edition = what the org bought (one per org). Preset = which halls run (several).
 * Hotel mode = department of a hotel with room charge; never derived from edition.
 * Price lives on `pricing_modules` only — presets are not billed.
 */
export const FNB_EDITIONS = ["kafe", "fnb"] as const;
export type FnbEdition = (typeof FNB_EDITIONS)[number];

export const FNB_PRESETS = ["cafe", "restaurant", "banquet"] as const;
export type FnbPreset = (typeof FNB_PRESETS)[number];

const ALLOWED: Record<FnbEdition, readonly FnbPreset[]> = {
  kafe: ["cafe"],
  fnb: ["cafe", "restaurant", "banquet"],
};

const DEFAULT: Record<FnbEdition, readonly FnbPreset[]> = {
  kafe: ["cafe"],
  fnb: ["restaurant"],
};

/** Presets with screens today. `banquet` is stored and allowed but has no screens yet. */
export const FNB_SELECTABLE_PRESETS: readonly FnbPreset[] = ["cafe", "restaurant"];

/** Orchestrator sends `kafe` or a subscription plan label; anything but `kafe` is full F&B. */
export function normalizeFnbEdition(raw: string | null | undefined): FnbEdition {
  return raw?.trim().toLowerCase() === "kafe" ? "kafe" : "fnb";
}

export function isFnbPreset(value: unknown): value is FnbPreset {
  return typeof value === "string" && (FNB_PRESETS as readonly string[]).includes(value);
}

export function allowedFnbPresets(edition: FnbEdition): FnbPreset[] {
  return [...ALLOWED[edition]];
}

export function defaultFnbPresets(edition: FnbEdition): FnbPreset[] {
  return [...DEFAULT[edition]];
}

/** Legacy full F&B orgs with no module list keep every submodule; Kafe and synced orgs are metered. */
export function fnbSubmodulesMetered(profile: {
  edition: string;
  activeModules: readonly string[];
}): boolean {
  return normalizeFnbEdition(profile.edition) === "kafe" || profile.activeModules.length > 0;
}

/** Kitchen display is on when the module is bought, or for a legacy unmetered org. */
export function fnbKitchenOn(profile: {
  edition: string;
  activeModules: readonly string[];
}): boolean {
  return !fnbSubmodulesMetered(profile) || profile.activeModules.includes("fnb_kitchen_kds");
}

/** Keeps only presets the edition allows, in catalog order; empty falls back to the edition default. */
export function clampFnbPresets(
  edition: FnbEdition,
  presets: readonly unknown[] | null | undefined,
): FnbPreset[] {
  const wanted = new Set((presets ?? []).filter(isFnbPreset));
  const allowed = ALLOWED[edition];
  const kept = FNB_PRESETS.filter((p) => wanted.has(p) && allowed.includes(p));
  return kept.length > 0 ? kept : defaultFnbPresets(edition);
}
