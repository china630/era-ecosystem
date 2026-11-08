/**
 * Card identity for one procedure regime.
 * Sites, laterality, apply mode, and physio fields. Display text and the note are not part of the key.
 */

export type RegimeKeyInput = {
  siteIds?: string[] | null;
  siteLaterality?: Record<string, string | null | undefined> | null;
  siteApplyMode?: string | null;
  physioFields?: unknown;
};

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(",")}}`;
}

export function regimeFingerprint(input: RegimeKeyInput): string {
  const sites = [...(input.siteIds ?? [])].sort().map((id) => {
    const side = input.siteLaterality?.[id] ?? "";
    return `${id}:${side ?? ""}`;
  });
  const mode = input.siteApplyMode ?? "";
  const fields =
    input.physioFields && typeof input.physioFields === "object" && !Array.isArray(input.physioFields)
      ? stableJson(input.physioFields)
      : "";
  return `${sites.join(",")}|${mode}|${fields}`;
}

export function regimeFromOrderSites(input: {
  siteApplyMode?: string | null;
  physioFields?: unknown;
  sites?: Array<{ siteId: string; laterality?: string | null }>;
}): string {
  const siteIds = (input.sites ?? []).map((site) => site.siteId);
  const siteLaterality: Record<string, string | null> = {};
  for (const site of input.sites ?? []) siteLaterality[site.siteId] = site.laterality ?? null;
  return regimeFingerprint({
    siteIds,
    siteLaterality,
    siteApplyMode: input.siteApplyMode,
    physioFields: input.physioFields,
  });
}
